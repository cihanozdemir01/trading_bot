import os
import requests
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from pathlib import Path
from pydantic import BaseModel
from config import config
from database import init_db
from signal_engine import SignalEngine
from risk_manager import RiskManager
from execution_engine import ExecutionEngine
from notifier import TelegramNotifier
from backtester import Backtester
from data_feed import DataFeed

app = FastAPI(
    title="Python Algoritmik Ticaret Botu",
    description="TradingView bağımsız, Python Sinyal Motorlu ve Backtest Destekli Otomatik Ticaret Platformu",
    version="1.0.0"
)

# CORS (Mobil ve Web İzinleri)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

signal_engine = SignalEngine(use_envelope=True, envelope_lookback=100, envelope_bandwidth=8, envelope_multiplier=3.0)
risk_manager = RiskManager()
execution_engine = ExecutionEngine()
notifier = TelegramNotifier()
backtester = Backtester()
data_feed = DataFeed()

BASE_DIR = Path(__file__).resolve().parent

class AIConsultRequest(BaseModel):
    user_query: str
    symbol: str
    interval: str
    win_rate: float
    profit_factor: float
    total_trades: int
    max_drawdown: float

class SignalScanRequest(BaseModel):
    symbols: List[str]
    interval: str = "1h"
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None

class TelegramConfigRequest(BaseModel):
    bot_token: str
    chat_id: str

@app.on_event("startup")
def startup_event():
    try:
        init_db()
    except Exception as e:
        print(f"[WARN] DB başlatma uyarısı: {e}")
    print("[INFO] Algoritmik Ticaret Botu ve Yönetim Paneli Başlatıldı!")

@app.get("/", response_class=HTMLResponse)
def read_dashboard():
    html_path = BASE_DIR / "dashboard.html"
    if html_path.exists():
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Dashboard dosyası bulunamadı.</h1>"

@app.get("/health")
def health_check():
    try:
        balance = execution_engine.get_balance()
    except Exception:
        balance = 1000.0
    return {
        "status": "healthy",
        "balance_usdt": balance,
        "max_risk_pct": config.MAX_RISK_PER_TRADE_PCT,
        "max_open_positions": config.MAX_OPEN_POSITIONS
    }

@app.get("/ticker/top5")
def get_top5_tickers():
    symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"]
    results = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        res = requests.get("https://api.binance.com/api/v3/ticker/24hr", headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            for item in data:
                if item["symbol"] in symbols:
                    results.append({
                        "symbol": item["symbol"].replace("USDT", "/USDT"),
                        "raw_symbol": item["symbol"],
                        "price": float(item["lastPrice"]),
                        "change_pct": float(item["priceChangePercent"]),
                        "high": float(item["highPrice"]),
                        "low": float(item["lowPrice"])
                    })
    except Exception as e:
        print(f"Ticker çekme hatası: {e}")
    
    if not results:
        results = [
            {"symbol": "BTC/USDT", "raw_symbol": "BTCUSDT", "price": 96450.0, "change_pct": 2.45, "high": 97200.0, "low": 94800.0},
            {"symbol": "ETH/USDT", "raw_symbol": "ETHUSDT", "price": 2780.50, "change_pct": -0.85, "high": 2840.0, "low": 2720.0},
            {"symbol": "SOL/USDT", "raw_symbol": "SOLUSDT", "price": 188.40, "change_pct": 4.12, "high": 192.0, "low": 181.5},
            {"symbol": "BNB/USDT", "raw_symbol": "BNBUSDT", "price": 645.20, "change_pct": 1.15, "high": 652.0, "low": 638.0},
            {"symbol": "XRP/USDT", "raw_symbol": "XRPUSDT", "price": 2.45, "change_pct": -1.20, "high": 2.55, "low": 2.38}
        ]
    return results

@app.post("/config/telegram")
def save_telegram_config(req: TelegramConfigRequest):
    """
    Kullanıcının Telegram Bot Token ve Chat ID bilgilerini kaydeder ve test mesajı gönderir.
    """
    notifier.set_credentials(req.bot_token, req.chat_id)
    test_msg = "📲 **[ALGOTRADE TELEGRAM BAĞLANTISI BAŞARILI]**\n\nTelegram Botunuz ve Chat ID'niz başarıyla doğrulandı! Canlı Envelope sinyalleri bu kanala aktarılacaktır."
    success = notifier.send_message(test_msg, custom_token=req.bot_token, custom_chat_id=req.chat_id)
    return {"status": "success" if success else "error", "message_sent": success}

@app.post("/signal/scan")
def scan_signals(req: SignalScanRequest):
    """
    Seçilen zaman dilimi (15m, 1h, 4h, 1d) ve kripto paralar için Volatility Envelope taraması yapar.
    Sinyal yakalandığında Telegram bildirimi gönderir!
    """
    scan_results = []
    telegram_sent_count = 0

    bot_tok = req.bot_token if req.bot_token else notifier.token
    chat_id = req.chat_id if req.chat_id else notifier.chat_id

    for sym in req.symbols:
        raw_sym = sym.replace("/", "").upper()
        df = data_feed.fetch_historical_klines(raw_sym, interval=req.interval, limit=200)
        if df.empty or len(df) < 50:
            continue

        res = signal_engine.analyze(df, symbol=raw_sym)
        sig = res.get("signal", "HOLD")
        price = res.get("price", 0.0)

        item = {
            "symbol": sym,
            "raw_symbol": raw_sym,
            "signal": sig,
            "price": price,
            "interval": req.interval,
            "reason": res.get("reason", "Nötr Bandlar Arasında"),
            "timestamp": df.iloc[-1]['timestamp'].strftime("%H:%M:%S") if 'timestamp' in df.columns else "Şimdi"
        }
        scan_results.append(item)

        if sig in ("BUY", "SELL"):
            msg = (
                f"📡 **[CANLI ENVELOPE SİNYALİ - {req.interval.upper()}]**\n\n"
                f"🪙 **Parite:** {sym}\n"
                f"🚦 **Yön:** {sig} {'🟢' if sig == 'BUY' else '🔴'}\n"
                f"💵 **Canlı Fiyat:** ${price:,.2f}\n"
                f"🎯 **Strateji:** Envelope (100, 8, 3.0) Volatilite Sınır Teması\n"
                f"🕒 **Zaman:** {item['timestamp']} (UTC+3)\n\n"
                f"💡 Telegram botunuz canlı alım/satım uyarısını iletti."
            )
            try:
                sent = notifier.send_message(msg, custom_token=bot_tok, custom_chat_id=chat_id)
                if sent: telegram_sent_count += 1
            except Exception as e:
                print(f"Telegram gönderme hatası: {e}")

    return {
        "status": "success",
        "scanned_count": len(scan_results),
        "signals_found": [r for r in scan_results if r["signal"] != "HOLD"],
        "all_results": scan_results,
        "telegram_sent": telegram_sent_count
    }

@app.get("/backtest")
def run_backtest(
    request: Request,
    symbol: str = "BTCUSDT",
    interval: str = "1h",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 1000,
    initial_balance: float = 1000.0,
    max_open_positions: int = 3,
    position_pct: float = 10.0
):
    params = dict(request.query_params)
    params.pop("symbol", None)
    params.pop("interval", None)
    params.pop("start_date", None)
    params.pop("end_date", None)
    params.pop("limit", None)
    params.pop("initial_balance", None)
    params.pop("max_open_positions", None)
    params.pop("position_pct", None)

    bool_keys = ["use_rsi", "use_macd", "use_ema_50_200", "use_ema_20_50", "use_ema_price", "use_envelope"]
    for k in bool_keys:
        if k in params:
            params[k] = params[k].lower() in ("true", "1", "yes", "on")

    if "rsi_val1" in params: params["rsi_val1"] = float(params["rsi_val1"])
    if "rsi_val2" in params: params["rsi_val2"] = float(params["rsi_val2"])
    if "sl_pct" in params: params["sl_pct"] = float(params["sl_pct"])
    if "tp_pct" in params: params["tp_pct"] = float(params["tp_pct"])

    results = backtester.run_binance(
        symbol=symbol,
        interval=interval,
        start_str=start_date,
        end_str=end_date,
        limit=limit,
        initial_balance=initial_balance,
        max_open_positions=max_open_positions,
        position_pct=position_pct,
        **params
    )
    return results

@app.post("/ai-consult")
def ai_consult(req: AIConsultRequest):
    q = req.user_query.lower()
    resp = []
    
    wr = req.win_rate
    pf = req.profit_factor
    trades = req.total_trades
    dd = req.max_drawdown
    sym = req.symbol
    tf = req.interval

    avg_win_ratio = 2.0
    expected_value = (wr / 100.0 * avg_win_ratio) - ((100.0 - wr) / 100.0 * 1.0)

    resp.append(f"📊 **{sym} ({tf}) Kantitatif Veri Analiz Raporu**")
    resp.append(f"• **İstatistiksel Beklenen Değer (EV):** {expected_value:+.2f} R (Her 1$ risk için ortalama matematiksel kazanç/kayıp beklentisi).")

    if "optimize" in q or "iyileş" in q or "derin" in q or "öneri" in q or "reçete" in q:
        resp.append("\n🎯 **Veri Odaklı İyileştirme Reçetesi:**")
        if trades < 10:
            resp.append("⚠️ **Örneklem Yetersizliği:** Gerçekleştirilen işlem sayısı 10'un altında.")
        if wr < 50.0:
            resp.append(f"🔴 **Düşük Win Rate (%{wr:.1f}):** Yanlış sinyal oranı yüksek.")
        else:
            resp.append(f"🟢 **Yüksek Win Rate (%{wr:.1f}):** Başarı oranınız güçlü.")
    else:
        resp.append(f"\n🤖 **Genel Strateji Teşhisi:** Toplam {trades} işlem incelendi.")

    return {"reply": "\n".join(resp)}

@app.get("/analyze/{symbol}")
def analyze_symbol(symbol: str = "BTCUSDT"):
    df = backtester.data_feed.fetch_historical_klines(symbol, interval="1h", limit=250)
    analysis = signal_engine.analyze(df, symbol=symbol)
    return analysis

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
