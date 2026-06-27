import pandas as pd
import numpy as np
from signal_engine import SignalEngine
from data_feed import DataFeed

class Backtester:
    def __init__(self, commission_rate: float = 0.00075):
        self.commission_rate = commission_rate
        self.data_feed = DataFeed()

    def run_binance(
        self,
        symbol: str = "BTCUSDT",
        interval: str = "1h",
        start_str: str = None,
        end_str: str = None,
        limit: int = 1000,
        initial_balance: float = 1000.0,
        max_open_positions: int = 3,
        position_pct: float = 10.0,
        **strategy_kwargs
    ) -> dict:
        df = self.data_feed.fetch_historical_klines(symbol, interval, start_str, end_str, limit)
        if df.empty:
            df = generate_sample_data(500)
            
        signal_engine = SignalEngine(**strategy_kwargs)
        return self.run(
            df,
            symbol=symbol,
            signal_engine=signal_engine,
            initial_balance=initial_balance,
            max_open_positions=max_open_positions,
            position_pct=position_pct
        )

    def run(
        self,
        df: pd.DataFrame,
        symbol: str = "BTCUSDT",
        signal_engine: SignalEngine = None,
        initial_balance: float = 1000.0,
        max_open_positions: int = 3,
        position_pct: float = 10.0
    ) -> dict:
        if signal_engine is None:
            signal_engine = SignalEngine()

        df_ind = signal_engine.add_indicators(df)
        
        balance = initial_balance
        equity_curve = [balance]
        trades = []
        open_positions = []

        min_bars = max(200, signal_engine.ema_slow if hasattr(signal_engine, 'ema_slow') else 200)

        for i in range(min_bars, len(df_ind)):
            current_slice = df_ind.iloc[:i+1]
            last_row = current_slice.iloc[-1]
            current_price = float(last_row['close'])
            high_price = float(last_row['high'])
            low_price = float(last_row['low'])
            timestamp = str(last_row.get('timestamp', i))

            still_open_positions = []
            for pos in open_positions:
                side = pos['side']
                sl = pos['stop_loss']
                tp = pos['take_profit']
                entry_p = pos['entry_price']
                qty = pos['quantity']

                exit_price = None
                exit_reason = None

                if side == 'BUY':
                    if low_price <= sl:
                        exit_price = sl
                        exit_reason = 'STOP_LOSS'
                    elif high_price >= tp:
                        exit_price = tp
                        exit_reason = 'TAKE_PROFIT'
                elif side == 'SELL':
                    if high_price >= sl:
                        exit_price = sl
                        exit_reason = 'STOP_LOSS'
                    elif low_price <= tp:
                        exit_price = tp
                        exit_reason = 'TAKE_PROFIT'

                if exit_price:
                    if side == 'BUY':
                        pnl = (exit_price - entry_p) * qty
                    else:
                        pnl = (entry_p - exit_price) * qty
                    
                    commission = (entry_p * qty + exit_price * qty) * self.commission_rate
                    net_pnl = pnl - commission
                    balance += net_pnl
                    
                    pos['exit_price'] = exit_price
                    pos['exit_time'] = timestamp
                    pos['pnl'] = round(net_pnl, 2)
                    pos['pnl_pct'] = round((net_pnl / (entry_p * qty)) * 100, 2)
                    pos['exit_reason'] = exit_reason
                    trades.append(pos)
                else:
                    still_open_positions.append(pos)

            open_positions = still_open_positions

            if len(open_positions) < max_open_positions:
                analysis = signal_engine.analyze(current_slice, symbol)
                sig = analysis['signal']
                
                if sig in ['BUY', 'SELL']:
                    sl = analysis['stop_loss']
                    tp = analysis['take_profit']
                    price = analysis['price']
                    
                    trade_amount = balance * (position_pct / 100.0)
                    if trade_amount > 0 and price > 0:
                        qty = trade_amount / price
                        new_trade = {
                            'symbol': symbol,
                            'side': sig,
                            'entry_price': price,
                            'entry_time': timestamp,
                            'quantity': qty,
                            'stop_loss': sl,
                            'take_profit': tp,
                            'reason': analysis['reason']
                        }
                        open_positions.append(new_trade)

            equity_curve.append(balance)

        win_trades = [t for t in trades if t['pnl'] > 0]
        loss_trades = [t for t in trades if t['pnl'] <= 0]
        total_trades = len(trades)
        win_rate = (len(win_trades) / total_trades * 100) if total_trades > 0 else 0.0

        total_profit = sum(t['pnl'] for t in win_trades)
        total_loss = abs(sum(t['pnl'] for t in loss_trades))
        profit_factor = (total_profit / total_loss) if total_loss > 0 else (total_profit if total_profit > 0 else 0.0)

        equity_series = pd.Series(equity_curve)
        rolling_max = equity_series.cummax()
        drawdowns = (equity_series - rolling_max) / rolling_max
        max_drawdown_pct = abs(drawdowns.min() * 100) if not drawdowns.empty else 0.0

        total_return_pct = round(((balance - initial_balance) / initial_balance) * 100, 2)

        # AI OTOMATİK İYİLEŞTİRME VEYA DEĞERLENDİRME ÖNERİLERİ
        ai_advice = []
        if total_trades == 0:
            ai_advice.append("⚠️ **Sinyal Bulunamadı:** Seçili filtreler birbirleriyle çelişiyor olabilir. Örn: RSI < 35 ve Fiyat > EMA50 aynı anda çok nadir gerçekleşir. Kutucuklardan birini kaldırıp deneyin.")
        else:
            if win_rate < 40.0:
                ai_advice.append(f"🔴 **Düşük Kazanma Oranı (%{win_rate:.1f}):** Yanlış sinyal oranı yüksek. Sinyal kalitesini artırmak için MACD veya Fiyat/EMA filtresini aktif ederek trend yönünde işlemlere girin.")
            elif win_rate >= 55.0:
                ai_advice.append(f"🟢 **Yüksek Başarı Oranı (%{win_rate:.1f}):** Stratejiniz oldukça istikrarlı çalışıyor!")

            if max_drawdown_pct > 15.0:
                ai_advice.append(f"⚠️ **Yüksek Sermaye Riski (%{max_drawdown_pct:.1f}):** Max Drawdown oranınız %15'in üzerinde. Riskinizi düşürmek için İşlem Başı Kasa Kullanım oranını (Örn: %10'dan %5'e) düşürün veya Stop Loss yüzdesini daraltın.")
            
            if profit_factor >= 1.5:
                ai_advice.append(f"🔥 **Mükemmel Kâr Faktörü ({profit_factor:.2f}):** Kazanılan kârlar kayıplardan çok daha büyük. Take Profit hedefinizi biraz daha büyüterek kârınızı katlayabilirsiniz.")
            elif profit_factor < 1.0 and total_trades > 0:
                ai_advice.append("❌ **Negatif Beklenti (Profit Factor < 1.0):** Kârlı işlemler zararları karşılayamıyor. Stop Loss oranınızı daraltmayı veya Risk/Ödül oranını (TP/SL) en az 1:2 seviyesine getirmeyi deneyin.")

            if total_trades < 10:
                ai_advice.append("ℹ️ **Yetersiz Örneklem:** İstatistiksel olarak daha güvenilir bir sonuç için tarih aralığını genişleterek en az 30-50 işlem içeren bir test yapmanızı öneririz.")

        return {
            "initial_balance": initial_balance,
            "final_balance": round(balance, 2),
            "total_return_pct": total_return_pct,
            "total_trades": total_trades,
            "win_trades": len(win_trades),
            "loss_trades": len(loss_trades),
            "win_rate": round(win_rate, 2),
            "profit_factor": round(profit_factor, 2),
            "max_drawdown_pct": round(max_drawdown_pct, 2),
            "trades": trades,
            "ai_advice": ai_advice
        }

def generate_sample_data(num_bars: int = 500) -> pd.DataFrame:
    np.random.seed(42)
    price = 30000.0
    prices = []
    for _ in range(num_bars):
        change = np.random.normal(0, 50)
        price += change
        prices.append(max(price, 1000.0))
    
    df = pd.DataFrame({'close': prices})
    df['open'] = df['close'].shift(1).fillna(df['close'])
    df['high'] = df[['open', 'close']].max(axis=1) + np.random.uniform(5, 20, num_bars)
    df['low'] = df[['open', 'close']].min(axis=1) - np.random.uniform(5, 20, num_bars)
    df['volume'] = np.random.uniform(10, 100, num_bars)
    df['timestamp'] = pd.date_range(start="2026-01-01", periods=num_bars, freq="1h")
    return df
