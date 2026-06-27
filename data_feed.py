import requests
import pandas as pd
from datetime import datetime, timedelta
import time

class DataFeed:
    def __init__(self):
        self.base_url = "https://api.binance.com/api/v3/klines"
        self.futures_url = "https://fapi.binance.com/fapi/v1/klines"

    def fetch_historical_klines(self, symbol: str = "BTCUSDT", interval: str = "1h", start_str: str = None, end_str: str = None, limit: int = 1000) -> pd.DataFrame:
        """
        Binance REST API'sinden mum verilerini çeker ve zaman damgalarını TradingView ile birebir
        uyumlu olması için UTC+3 (Türkiye Saati) olarak dönüştürür.
        """
        symbol = symbol.upper()
        
        start_ts = None
        end_ts = None

        if start_str:
            try:
                dt_start = datetime.strptime(start_str, "%Y-%m-%d")
                start_ts = int(dt_start.timestamp() * 1000)
            except Exception:
                pass
                
        if end_str:
            try:
                dt_end = datetime.strptime(end_str, "%Y-%m-%d")
                end_ts = int(dt_end.timestamp() * 1000)
            except Exception:
                pass

        all_klines = []
        current_start = start_ts
        
        if not start_ts:
            params = {"symbol": symbol, "interval": interval, "limit": limit}
            try:
                res = requests.get(self.futures_url, params=params, timeout=10)
                if res.status_code != 200:
                    res = requests.get(self.base_url, params=params, timeout=10)
                all_klines = res.json()
            except Exception as e:
                print(f"Veri çekme hatası: {e}")
        else:
            while True:
                params = {
                    "symbol": symbol,
                    "interval": interval,
                    "limit": 1000
                }
                if current_start:
                    params["startTime"] = current_start
                if end_ts:
                    params["endTime"] = end_ts

                try:
                    res = requests.get(self.futures_url, params=params, timeout=10)
                    if res.status_code != 200:
                        res = requests.get(self.base_url, params=params, timeout=10)

                    data = res.json()
                    if not isinstance(data, list) or len(data) == 0:
                        break

                    all_klines.extend(data)
                    
                    last_close_time = data[-1][6]
                    current_start = last_close_time + 1

                    if end_ts and last_close_time >= end_ts:
                        break

                    if len(data) < 1000:
                        break

                    time.sleep(0.05)

                except Exception as e:
                    print(f"Döngüsel veri çekme hatası: {e}")
                    break

        if not all_klines or not isinstance(all_klines, list):
            return pd.DataFrame()

        cols = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 
                'close_time', 'quote_asset_volume', 'number_of_trades', 
                'taker_buy_base_asset_volume', 'taker_buy_quote_asset_volume', 'ignore']
        
        df = pd.DataFrame(all_klines, columns=cols)
        df.drop_duplicates(subset=['timestamp'], inplace=True)

        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = df[col].astype(float)

        # UTC zaman damgasını Türkiye saatine (UTC+3) çeviriyoruz (TradingView saatleriyle birebir eşleşmesi için)
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms') + timedelta(hours=3)
        return df[['timestamp', 'open', 'high', 'low', 'close', 'volume']].sort_values('timestamp').reset_index(drop=True)
