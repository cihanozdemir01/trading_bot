from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from typing import Optional
from pathlib import Path
from pydantic import BaseModel
from config import config
from database import init_db
from signal_engine import SignalEngine
from risk_manager import RiskManager
from execution_engine import ExecutionEngine
from notifier import TelegramNotifier
from backtester import Backtester

app = FastAPI(
    title="Python Algoritmik Ticaret Botu",
    description="TradingView bağımsız, Python Sinyal Motorlu ve Backtest Destekli Otomatik Ticaret Platformu",
    version="1.0.0"
)

signal_engine = SignalEngine()
risk_manager = RiskManager()
execution_engine = ExecutionEngine()
notifier = TelegramNotifier()
backtester = Backtester()

BASE_DIR = Path(__file__).resolve().parent

class AIConsultRequest(BaseModel):
    user_query: str
    symbol: str
    interval: str
    win_rate: float
    profit_factor: float
    total_trades: int
    max_drawdown: float

@app.on_event("startup")
def startup_event():
    init_db()
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
    balance = execution_engine.get_balance()
    return {
        "status": "healthy",
        "balance_usdt": balance,
        "max_risk_pct": config.MAX_RISK_PER_TRADE_PCT,
        "max_open_positions": config.MAX_OPEN_POSITIONS
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

    bool_keys = ["use_rsi", "use_macd", "use_ema_50_200", "use_ema_20_50", "use_ema_price"]
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
    """
    Sayfa üzerinden kullanıcının sorduğu sorulara veya derin strateji iyileştirme isteklerine yanıt üretir.
    """
    q = req.user_query.lower()
    resp = []

    if "optimize" in q or "iyileş" in q or "derin" in q or "öneri" in q:
        resp.append(f"🧠 **{req.symbol} ({req.interval}) Strateji İyileştirme Reçetesi:**")
        if req.win_rate < 45:
            resp.append("• **Yanlış Sinyal Filtresi:** Sinyal kaybı yüksek. 1 Saatlik grafiklerde sadece MACD kesişimine güvenmek yerine **Fiyat > EMA 200** filtresini aktif edin. Bu, trend karşıtı hatalı alımları %40 engeller.")
        if req.max_drawdown > 12:
            resp.append("• **Sermaye Koruma:** Max Drawdown oranınız yüksek. İşlem başı kasa kullanımınızı %5 seviyesine çekip Stop Loss'u %1.2'ye daraltın.")
        if req.profit_factor >= 1.3:
            resp.append("• **Kâr Katlama:** Stratejinizin kârlı işlemler potansiyeli yüksek. Take Profit seviyenizi %3.0'ten %4.5'e çekerek Trailing Stop (Takip Eden Stop) mantığı uygulayın.")
    elif "win rate" in q or "başarı" in q or "kazan" in q:
        resp.append(f"📊 **Kazanma Oranı Analizi (%{req.win_rate}):**")
        resp.append("Başarı oranını %60+ seviyelerine çıkarmak için yatay piyasa (consolidation) dönemlerinde işlem açılmasını önlemelisiniz. Bunun için Hacim veya RSI Arasında filtresini kullanabilirsiniz.")
    elif "risk" in q or "drawdown" in q or "zarar" in q:
        resp.append(f"🛡️ **Risk Analizi (Max Drawdown: %{req.max_drawdown}):**")
        resp.append("Peş peşe gelen zararlı işlemleri engellemek için Günlük Maksimum Zarar Limitini (%3.0) sıkı tutun ve aynı anda en fazla 2 pozisyon taşıyın.")
    else:
        resp.append(f"🤖 **AI Yanıtı ({req.symbol} için):**")
        resp.append(f"Mevcut testinizde **{req.total_trades} işlem** gerçekleştirildi. Win Rate: %{req.win_rate}, Profit Factor: {req.profit_factor}. Stratejiyi daha agresif yapmak için zaman dilimini 15 dakikaya düşürebilir, daha güvenli yapmak için EMA 50/200 Golden Cross filtresini açabilirsiniz.")

    return {"reply": "\n\n".join(resp)}

@app.get("/analyze/{symbol}")
def analyze_symbol(symbol: str = "BTCUSDT"):
    df = backtester.data_feed.fetch_historical_klines(symbol, interval="1h", limit=250)
    analysis = signal_engine.analyze(df, symbol=symbol)
    return analysis

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
