import requests
import logging
from config import config

class TelegramNotifier:
    def __init__(self):
        self.token = config.TELEGRAM_BOT_TOKEN
        self.chat_id = config.TELEGRAM_CHAT_ID

    def set_credentials(self, token: str, chat_id: str):
        if token: self.token = token.strip()
        if chat_id: self.chat_id = chat_id.strip()

    def send_message(self, text: str, custom_token: str = None, custom_chat_id: str = None) -> bool:
        """
        Telegram grubuna/kanalına Markdown formatında mesaj yollar.
        """
        token = custom_token.strip() if custom_token else self.token
        chat_id = custom_chat_id.strip() if custom_chat_id else self.chat_id

        if not token or not chat_id:
            print(f"[TELEGRAM SIMULATOR]: {text}")
            return False

        base_url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown"
        }
        try:
            response = requests.post(base_url, json=payload, timeout=8)
            return response.status_code == 200
        except Exception as e:
            logging.error(f"Telegram mesaj gönderme hatası: {e}")
            return False

    def notify_trade_opened(self, symbol: str, side: str, price: float, sl: float, tp: float, qty: float, reason: str):
        emoji = "🟢" if side == "BUY" else "🔴"
        text = (
            f"{emoji} *YENİ İŞLEM AÇILDI*\n\n"
            f"*Coin:* `{symbol}`\n"
            f"*Yön:* `{side}`\n"
            f"*Giriş Fiyatı:* `${price:.2f}`\n"
            f"*Miktar:* `{qty:.4f}`\n"
            f"*Stop Loss:* `${sl:.2f}`\n"
            f"*Take Profit:* `${tp:.2f}`\n\n"
            f"*Sebep:* _{reason}_"
        )
        self.send_message(text)

    def notify_trade_closed(self, symbol: str, side: str, pnl: float, pnl_pct: float, reason: str):
        emoji = "💰" if pnl >= 0 else "🔻"
        text = (
            f"{emoji} *İŞLEM KAPANDI*\n\n"
            f"*Coin:* `{symbol}`\n"
            f"*Yön:* `{side}`\n"
            f"*Net PnL:* `${pnl:.2f}` (`%{pnl_pct:.2f}`)\n"
            f"*Kapanış Nedeni:* `{reason}`"
        )
        self.send_message(text)
