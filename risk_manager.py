from config import config

class RiskManager:
    def __init__(self):
        self.max_risk_pct = config.MAX_RISK_PER_TRADE_PCT
        self.max_daily_loss_pct = config.MAX_DAILY_LOSS_PCT
        self.max_open_positions = config.MAX_OPEN_POSITIONS

    def validate_trade(self, signal: dict, current_open_positions: int, account_balance: float, daily_pnl_pct: float) -> dict:
        """
        Gelen sinyalin risk kurallarına uygunluğunu denetler ve uygunsa pozisyon büyüklüğünü hesaplar.
        """
        # 1. Günlük Maksimum Zarar Kontrolü
        if daily_pnl_pct <= -self.max_daily_loss_pct:
            return {
                "allowed": False,
                "reason": f"Günlük maksimum zarar limitine ulaşıldı! (Günlük PnL: %{daily_pnl_pct:.2f}, Limit: -%{self.max_daily_loss_pct})"
            }

        # 2. Maksimum Açık Pozisyon Kontrolü
        if current_open_positions >= self.max_open_positions:
            return {
                "allowed": False,
                "reason": f"Maksimum açık pozisyon limitine ulaşıldı! (Mevcut: {current_open_positions}, Limit: {self.max_open_positions})"
            }

        # 3. Pozisyon Büyüklüğü (Lot Sizing) Hesaplama
        entry_price = signal.get("price", 0.0)
        stop_loss = signal.get("stop_loss", 0.0)

        if entry_price <= 0 or stop_loss <= 0:
            return {"allowed": False, "reason": "Geçersiz giriş veya Stop Loss fiyatı"}

        # Risk Edilecek Dolar Tutarı (Örn: 1000$ bakiyede %1 risk = 10$)
        risk_amount_usd = account_balance * (self.max_risk_pct / 100.0)

        # Hisseli/Miktar Bazlı Stop Mesafesi Yüzdesi
        price_risk_pct = abs(entry_price - stop_loss) / entry_price

        if price_risk_pct == 0:
            return {"allowed": False, "reason": "Stop Loss mesafesi sıfır olamaz"}

        # Toplam Pozisyon Büyüklüğü (USD cinsinden)
        position_size_usd = risk_amount_usd / price_risk_pct
        
        # Coindeki Miktar (Quantity)
        quantity = position_size_usd / entry_price

        return {
            "allowed": True,
            "position_size_usd": round(position_size_usd, 2),
            "quantity": round(quantity, 4),
            "risk_amount_usd": round(risk_amount_usd, 2),
            "price_risk_pct": round(price_risk_pct * 100, 2),
            "reason": "Risk onaylandı"
        }
