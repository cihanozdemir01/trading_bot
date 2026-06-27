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
                return 1000.0  # Simüle varsayılan bakiye
        return 1000.0  # Simüle bakiye

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
            # Simüle Emir (API Key tanımlı değilse)
            return {
                "success": True,
                "order_id": "simulated_12345",
                "symbol": symbol,
                "price": price,
                "quantity": quantity,
                "simulated": True
            }
