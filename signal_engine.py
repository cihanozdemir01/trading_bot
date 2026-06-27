import pandas as pd
import numpy as np
try:
    import pandas_ta as ta
    HAS_PANDAS_TA = True
except ImportError:
    HAS_PANDAS_TA = False

class SignalEngine:
    def __init__(self, **kwargs):
        # İşaretleme Kutucukları (Aktif / Pasif)
        self.use_rsi = kwargs.get("use_rsi", True)
        self.use_macd = kwargs.get("use_macd", True)
        self.use_ema_50_200 = kwargs.get("use_ema_50_200", False)
        self.use_ema_20_50 = kwargs.get("use_ema_20_50", False)
        self.use_ema_price = kwargs.get("use_ema_price", True)

        # RSI Parametreleri
        self.rsi_op = kwargs.get("rsi_op", "less")  # 'between', 'greater', 'less'
        self.rsi_val1 = float(kwargs.get("rsi_val1", 35.0))
        self.rsi_val2 = float(kwargs.get("rsi_val2", 70.0))

        # MACD Parametreleri
        self.macd_cross = kwargs.get("macd_cross", "bullish")  # 'bullish', 'bearish', 'any'
        self.macd_zero = kwargs.get("macd_zero", "any")        # 'above_zero', 'below_zero', 'any'

        # EMA Parametreleri
        self.ema_50_200_cross = kwargs.get("ema_50_200_cross", "bullish")
        self.ema_20_50_cross = kwargs.get("ema_20_50_cross", "bullish")
        self.ema_price_filter = kwargs.get("ema_price_filter", "above_ema50")

        # Risk Parametreleri
        self.sl_pct = float(kwargs.get("sl_pct", 1.5))
        self.tp_pct = float(kwargs.get("tp_pct", 3.0))

    def add_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        
        if HAS_PANDAS_TA:
            df['rsi'] = df.ta.rsi(length=14)
            macd = df.ta.macd(fast=12, slow=26, signal=9)
            if macd is not None and not macd.empty:
                df['macd'] = macd.iloc[:, 0]
                df['macd_histogram'] = macd.iloc[:, 1]
                df['macd_signal'] = macd.iloc[:, 2]
            df['ema20'] = df.ta.ema(length=20)
            df['ema50'] = df.ta.ema(length=50)
            df['ema100'] = df.ta.ema(length=100)
            df['ema200'] = df.ta.ema(length=200)
        else:
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['rsi'] = 100 - (100 / (1 + rs))
            
            df['ema20'] = df['close'].ewm(span=20, adjust=False).mean()
            df['ema50'] = df['close'].ewm(span=50, adjust=False).mean()
            df['ema100'] = df['close'].ewm(span=100, adjust=False).mean()
            df['ema200'] = df['close'].ewm(span=200, adjust=False).mean()
            
            ema12 = df['close'].ewm(span=12, adjust=False).mean()
            ema26 = df['close'].ewm(span=26, adjust=False).mean()
            df['macd'] = ema12 - ema26
            df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
            df['macd_histogram'] = df['macd'] - df['macd_signal']
            
        return df

    def analyze(self, df: pd.DataFrame, symbol: str = "BTCUSDT") -> dict:
        if len(df) < 200:
            return {"signal": "HOLD", "reason": "Yetersiz mum verisi"}

        df_ind = self.add_indicators(df)
        last_row = df_ind.iloc[-1]
        prev_row = df_ind.iloc[-2]

        price = float(last_row['close'])
        rsi = float(last_row['rsi']) if pd.notnull(last_row['rsi']) else 50.0
        macd = float(last_row['macd']) if pd.notnull(last_row['macd']) else 0.0
        macd_hist = float(last_row['macd_histogram']) if pd.notnull(last_row['macd_histogram']) else 0.0
        prev_macd_hist = float(prev_row['macd_histogram']) if pd.notnull(prev_row['macd_histogram']) else 0.0

        ema20 = float(last_row['ema20']) if pd.notnull(last_row['ema20']) else price
        ema50 = float(last_row['ema50']) if pd.notnull(last_row['ema50']) else price
        ema100 = float(last_row['ema100']) if pd.notnull(last_row['ema100']) else price
        ema200 = float(last_row['ema200']) if pd.notnull(last_row['ema200']) else price

        prev_ema20 = float(prev_row['ema20']) if pd.notnull(prev_row['ema20']) else price
        prev_ema50 = float(prev_row['ema50']) if pd.notnull(prev_row['ema50']) else price
        prev_ema200 = float(prev_row['ema200']) if pd.notnull(prev_row['ema200']) else price

        reasons = []

        # --- 1. RSI KOŞULU ---
        rsi_valid = True
        if self.use_rsi:
            if self.rsi_op == "greater" and not (rsi > self.rsi_val1): rsi_valid = False
            elif self.rsi_op == "less" and not (rsi < self.rsi_val1): rsi_valid = False
            elif self.rsi_op == "between":
                min_v, max_v = min(self.rsi_val1, self.rsi_val2), max(self.rsi_val1, self.rsi_val2)
                if not (min_v <= rsi <= max_v): rsi_valid = False
            if rsi_valid: reasons.append(f"RSI ({rsi:.1f})")

        # --- 2. MACD KOŞULU ---
        macd_valid = True
        if self.use_macd:
            if self.macd_cross == "bullish" and not (prev_macd_hist <= 0 and macd_hist > 0): macd_valid = False
            elif self.macd_cross == "bearish" and not (prev_macd_hist >= 0 and macd_hist < 0): macd_valid = False
            
            if self.macd_zero == "above_zero" and not (macd > 0): macd_valid = False
            elif self.macd_zero == "below_zero" and not (macd < 0): macd_valid = False

            if macd_valid: reasons.append("MACD")

        # --- 3. EMA 50 / 200 KESİŞİMİ ---
        ema_50_200_valid = True
        if self.use_ema_50_200:
            if self.ema_50_200_cross == "bullish" and not (prev_ema50 <= prev_ema200 and ema50 > ema200): ema_50_200_valid = False
            elif self.ema_50_200_cross == "bearish" and not (prev_ema50 >= prev_ema200 and ema50 < ema200): ema_50_200_valid = False
            if ema_50_200_valid: reasons.append("EMA 50/200 Cross")

        # --- 4. EMA 20 / 50 KESİŞİMİ ---
        ema_20_50_valid = True
        if self.use_ema_20_50:
            if self.ema_20_50_cross == "bullish" and not (prev_ema20 <= prev_ema50 and ema20 > ema50): ema_20_50_valid = False
            elif self.ema_20_50_cross == "bearish" and not (prev_ema20 >= prev_ema50 and ema20 < ema50): ema_20_50_valid = False
            if ema_20_50_valid: reasons.append("EMA 20/50 Cross")

        # --- 5. FİYAT / EMA FİLTRESİ ---
        ema_price_valid = True
        if self.use_ema_price:
            if self.ema_price_filter == "above_ema20" and not (price > ema20): ema_price_valid = False
            elif self.ema_price_filter == "below_ema20" and not (price < ema20): ema_price_valid = False
            elif self.ema_price_filter == "above_ema50" and not (price > ema50): ema_price_valid = False
            elif self.ema_price_filter == "below_ema50" and not (price < ema50): ema_price_valid = False
            elif self.ema_price_filter == "above_ema100" and not (price > ema100): ema_price_valid = False
            elif self.ema_price_filter == "below_ema100" and not (price < ema100): ema_price_valid = False
            elif self.ema_price_filter == "above_ema200" and not (price > ema200): ema_price_valid = False
            elif self.ema_price_filter == "below_ema200" and not (price < ema200): ema_price_valid = False
            if ema_price_valid: reasons.append("Fiyat/EMA Konumu")

        # Aktif filtre kontrolü
        active_filters = []
        if self.use_rsi: active_filters.append(rsi_valid)
        if self.use_macd: active_filters.append(macd_valid)
        if self.use_ema_50_200: active_filters.append(ema_50_200_valid)
        if self.use_ema_20_50: active_filters.append(ema_20_50_valid)
        if self.use_ema_price: active_filters.append(ema_price_valid)

        if len(active_filters) == 0:
            return {"signal": "HOLD", "symbol": symbol, "price": price, "reason": "Hiçbir strateji kutucuğu seçilmedi!"}

        all_passed = all(active_filters)

        if all_passed:
            side = "BUY"
            if (self.use_macd and self.macd_cross == "bearish") or \
               (self.use_ema_50_200 and self.ema_50_200_cross == "bearish") or \
               (self.use_ema_20_50 and self.ema_20_50_cross == "bearish") or \
               (self.use_ema_price and "below" in self.ema_price_filter):
                side = "SELL"

            sl = price * (1.0 - self.sl_pct / 100.0) if side == "BUY" else price * (1.0 + self.sl_pct / 100.0)
            tp = price * (1.0 + self.tp_pct / 100.0) if side == "BUY" else price * (1.0 - self.tp_pct / 100.0)

            return {
                "signal": side,
                "symbol": symbol,
                "price": price,
                "stop_loss": round(sl, 2),
                "take_profit": round(tp, 2),
                "reason": " + ".join(reasons)
            }

        return {
            "signal": "HOLD",
            "symbol": symbol,
            "price": price,
            "reason": f"Seçili Kriterler Bekleniyor (RSI: {rsi:.1f})"
        }
