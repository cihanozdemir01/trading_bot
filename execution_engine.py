import logging
from config import config
try:
    import ccxt
    HAS_CCXT = True
except ImportError:
    HAS_CCXT = False

class ExecutionEngine:
    def __init__(self):
        self.use_testnet = config.USE_TESTNET
        self.exchange = None

        if HAS_CCXT and config.BINANCE_API_KEY and config.BINANCE_API_SECRET:
            try:
                self.exchange = ccxt.binance({
                    'apiKey': config.BINANCE_API_KEY,
                    'secret': config.BINANCE_API_SECRET,
                    'enableRateLimit': True,
                    'options': {'defaultType': 'future'}  # Vadeli İşlemler (Futures)
                })
                if self.use_testnet:
                    self.exchange.set_sandbox_mode(True)
            except Exception as e:
                logging.error(f"Binance API Bağlantı Hatası: {e}")

    def get_balance(self) -> float:
        """
        Kullanılabilir USDT bakiyesini getirir.
        """
        if self.exchange:
            try:
                balance = self.exchange.fetch_balance()
                return float(balance.get('USDT', {}).get('free', 1000.0))
            except Exception as e:
                logging.error(f"Bakiye okuma hatası: {e}")
                return 1000.0
        return 1000.0

    def fetch_positions(self) -> list:
        """
        Binance vadeli işlemler hesabındaki gerçek açık pozisyonları çeker.
        """
        if self.exchange:
            try:
                positions = self.exchange.fetch_positions()
                open_positions = []
                for pos in positions:
                    size = float(pos.get('contracts', 0) or pos.get('positionAmt', 0) or 0)
                    if size != 0:
                        open_positions.append({
                            "symbol": pos.get('symbol', '').replace('USDT', '/USDT'),
                            "size": size,
                            "entry_price": float(pos.get('entryPrice', 0) or 0),
                            "mark_price": float(pos.get('markPrice', 0) or 0),
                            "pnl": float(pos.get('unrealizedPnl', 0) or 0),
                            "pnl_pct": float(pos.get('percentage', 0) or 0.0),
                            "sl": 0.0,
                            "tp": 0.0
                        })
                return open_positions
            except Exception as e:
                logging.error(f"Açık pozisyonları ccxt ile okuma hatası: {e}")
                return []
        return []

    def execute_order(self, symbol: str, side: str, quantity: float, price: float, sl: float, tp: float) -> dict:
        """
        Binance ortamına Piyasa Emri ve beraberinde Stop Loss / Take Profit emirlerini gönderir.
        """
        if self.exchange:
            try:
                # 1. Ana Market Emri
                order_side = 'buy' if side == 'BUY' else 'sell'
                main_order = self.exchange.create_order(
                    symbol=symbol,
                    type='market',
                    side=order_side,
                    amount=quantity
                )
                
                # 2. Stop Loss ve Take Profit Emirleri
                sl_side = 'sell' if side == 'BUY' else 'buy'
                self.exchange.create_order(
                    symbol=symbol,
                    type='STOP_MARKET',
                    side=sl_side,
                    amount=quantity,
                    params={'stopPrice': sl}
                )
                self.exchange.create_order(
                    symbol=symbol,
                    type='TAKE_PROFIT_MARKET',
                    side=sl_side,
                    amount=quantity,
                    params={'stopPrice': tp}
                )

                return {
                    "success": True,
                    "order_id": main_order.get('id', 'mock_id'),
                    "symbol": symbol,
                    "price": main_order.get('price', price),
                    "quantity": quantity
                }
            except Exception as e:
                logging.error(f"Emir gönderme hatası: {e}")
                return {"success": False, "reason": str(e)}
        else:
            return {
                "success": True,
                "order_id": "simulated_12345",
                "symbol": symbol,
                "price": price,
                "quantity": quantity,
                "simulated": True
            }
