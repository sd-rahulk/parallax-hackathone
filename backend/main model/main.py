import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras import layers, models, callbacks
from sklearn.preprocessing import MinMaxScaler
 

SEQ_LEN = 30
RUL_CAP = 125
DUAL_HEAD = True
SENSOR_COLS = [f"s{i}" for i in range(1, 22)]
SETTING_COLS = ["setting1", "setting2", "setting3"]
FEATURE_COLS = SETTING_COLS + SENSOR_COLS
BATCH_SIZE = 64
EPOCHS = 100
RANDOM_STATE = 42
 
tf.random.set_seed(RANDOM_STATE)
np.random.seed(RANDOM_STATE)
 
 

def load_train(train_path):
    col_names = ["unit", "cycle"] + SETTING_COLS + SENSOR_COLS
    return pd.read_csv(train_path, sep=r"\s+", header=None, names=col_names)
 
 

def add_rul(df):
    max_cycle = df.groupby("unit")["cycle"].transform("max")
    df["RUL"] = (max_cycle - df["cycle"]).clip(upper=RUL_CAP)
    return df
 
 
def add_soh(df):
    df["SOH"] = (df["RUL"] / RUL_CAP * 100).clip(0, 100)
    return df
 
 

def normalize(df, feature_cols):
    scaler = MinMaxScaler()
    df[feature_cols] = scaler.fit_transform(df[feature_cols])
    return df, scaler
 
 

def build_sequences(df, feature_cols, seq_len, label_cols):
    X, y = [], []
    for unit_id, g in df.groupby("unit"):
        g = g.sort_values("cycle")
        data = g[feature_cols].values
        labels = g[label_cols].values
        n = len(g)
 
        if n < seq_len:
            pad = np.repeat(data[0:1], seq_len - n, axis=0)
            data = np.vstack([pad, data])
            X.append(data[-seq_len:])
            y.append(labels[-1])
            continue
 
        for start in range(0, n - seq_len + 1):
            X.append(data[start:start + seq_len])
            y.append(labels[start + seq_len - 1])
 
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)
 

def build_lstm_model(n_features, seq_len, dual_head=DUAL_HEAD):
    inp = layers.Input(shape=(seq_len, n_features), name="sensor_window")
 
    x = layers.LSTM(100, return_sequences=True, name="lstm_1")(inp)
    x = layers.LSTM(100, return_sequences=True, name="lstm_2")(x)
    x = layers.LSTM(75, return_sequences=False, name="lstm_3")(x)
    x = layers.Dropout(0.5, name="dropout")(x)
 
    rul_out = layers.Dense(1, activation="linear", name="RUL")(x)
 
    if dual_head:
        soh_out = layers.Dense(1, activation="sigmoid", name="SOH_raw")(x)
        soh_out = layers.Lambda(lambda t: t * 100.0, name="SOH")(soh_out)
        model = models.Model(inputs=inp, outputs=[rul_out, soh_out])
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
            loss={"RUL": "mse", "SOH": "mse"},
            loss_weights={"RUL": 1.0, "SOH": 0.3},
            metrics={"RUL": ["mae"], "SOH": ["mae"]},
        )
    else:
        model = models.Model(inputs=inp, outputs=rul_out)
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
            loss="mse",
            metrics=["mae"],
        )
    return model
 
 

def train(train_path):
    df = load_train(train_path)
    df = add_rul(df)
    df = add_soh(df)
    df, scaler = normalize(df, FEATURE_COLS)
 
    label_cols = ["RUL", "SOH"] if DUAL_HEAD else ["RUL"]
    X_train, y_train = build_sequences(df, FEATURE_COLS, SEQ_LEN, label_cols)
    print(f"Train sequences: {X_train.shape}")
 
    model = build_lstm_model(n_features=len(FEATURE_COLS), seq_len=SEQ_LEN)
    model.summary()
 
    cb = [
        callbacks.EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True),
        callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5, min_lr=1e-6),
    ]
 
    if DUAL_HEAD:
        y_dict = {"RUL": y_train[:, 0], "SOH": y_train[:, 1]}
        history = model.fit(
            X_train, y_dict,
            validation_split=0.15,
            epochs=EPOCHS, batch_size=BATCH_SIZE,
            callbacks=cb, verbose=1,
        )
    else:
        history = model.fit(
            X_train, y_train.flatten(),
            validation_split=0.15,
            epochs=EPOCHS, batch_size=BATCH_SIZE,
            callbacks=cb, verbose=1,
        )
 
    return model, history, scaler
 
 

if __name__ == "__main__":
    TRAIN_PATH = r"C:\Users\VISHAL KHUMAR P D\Downloads\FD001_processed.npz"
 
    model, history, scaler = train(TRAIN_PATH)
    model.save("layer2a_lstm_health_checkup.keras")