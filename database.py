from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from config import config

Base = declarative_base()

class TradeRecord(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String, nullable=False)
    side = Column(String, nullable=False)  # BUY / SELL
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    quantity = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=False)
    take_profit = Column(Float, nullable=False)
    pnl = Column(Float, nullable=True)
    pnl_pct = Column(Float, nullable=True)
    status = Column(String, default="OPEN")  # OPEN / CLOSED
    entry_time = Column(DateTime, default=datetime.utcnow)
    exit_time = Column(DateTime, nullable=True)
    reason = Column(String, nullable=True)

engine = create_engine(config.DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def log_open_trade(symbol: str, side: str, price: float, sl: float, tp: float, qty: float, reason: str) -> int:
    db = SessionLocal()
    try:
        trade = TradeRecord(
            symbol=symbol,
            side=side,
            entry_price=price,
            stop_loss=sl,
            take_profit=tp,
            quantity=qty,
            reason=reason,
            status="OPEN"
        )
        db.add(trade)
        db.commit()
        db.refresh(trade)
        return trade.id
    finally:
        db.close()

def log_close_trade(trade_id: int, exit_price: float, pnl: float, pnl_pct: float):
    db = SessionLocal()
    try:
        trade = db.query(TradeRecord).filter(TradeRecord.id == trade_id).first()
        if trade:
            trade.exit_price = exit_price
            trade.pnl = pnl
            trade.pnl_pct = pnl_pct
            trade.status = "CLOSED"
            trade.exit_time = datetime.utcnow()
            db.commit()
    finally:
        db.close()
