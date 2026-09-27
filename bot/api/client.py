"""HTTP-клиент к backend API KIROYA.

KiroyaAPI — тонкая обёртка над эндпоинтами (методы принимают токен явно).
UserSession — запросы от имени пользователя Telegram: берёт токен из Redis,
при 401 один раз обновляет его через refresh, иначе требует войти заново.
"""

from typing import Any

import httpx

from services.session import TokenStore


class APIError(Exception):
    def __init__(self, status: int, detail: Any) -> None:
        self.status = status
        self.detail = detail
        super().__init__(f"{status}: {detail}")

    @property
    def message(self) -> str:
        if isinstance(self.detail, str):
            return self.detail
        if isinstance(self.detail, list) and self.detail:
            return str(self.detail[0].get("msg", "Ошибка в данных"))
        return "Ошибка сервера"


class AuthRequired(Exception):
    """Нет токена или его не удалось обновить — нужно войти заново."""


class KiroyaAPI:
    def __init__(
        self, base_url: str, bot_secret: str, http: httpx.AsyncClient | None = None
    ) -> None:
        self.http = http or httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0))
        self.base_url = base_url.rstrip("/")
        self.bot_secret = bot_secret

    async def close(self) -> None:
        await self.http.aclose()

    async def request(
        self,
        method: str,
        path: str,
        *,
        token: str | None = None,
        telegram_id: int | None = None,
        **kwargs: Any,
    ) -> Any:
        headers = {"X-Bot-Secret": self.bot_secret}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if telegram_id is not None:
            headers["X-Telegram-User-Id"] = str(telegram_id)
        response = await self.http.request(
            method, f"{self.base_url}{path}", headers=headers, **kwargs
        )
        if response.status_code >= 400:
            try:
                detail = response.json().get("detail", response.text)
            except ValueError:
                detail = response.text
            raise APIError(response.status_code, detail)
        return response.json() if response.content else None

    # --- Auth ---
    async def send_otp(self, phone: str, telegram_id: int | None = None) -> dict[str, Any]:
        return await self.request(
            "POST", "/auth/send-otp", json={"phone": phone}, telegram_id=telegram_id
        )

    async def verify_otp(self, phone: str, code: str) -> dict[str, Any]:
        return await self.request("POST", "/auth/verify-otp", json={"phone": phone, "code": code})

    async def refresh(self, refresh_token: str) -> dict[str, Any]:
        return await self.request("POST", "/auth/refresh", json={"refresh_token": refresh_token})

    async def logout(self, token: str, refresh_token: str | None) -> None:
        await self.request(
            "POST", "/auth/logout", token=token, json={"refresh_token": refresh_token}
        )

    # --- Listings ---
    async def get_categories(self) -> list[dict[str, Any]]:
        return await self.request("GET", "/listings/categories")

    async def get_listings(
        self, category: str | None = None, city: str | None = None, page: int = 1, limit: int = 5
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"page": page, "limit": limit}
        if category:
            params["category"] = category
        if city:
            params["city"] = city
        return await self.request("GET", "/listings", params=params)

    async def get_listing(self, listing_id: str) -> dict[str, Any]:
        return await self.request("GET", f"/listings/{listing_id}")

    async def get_user_profile(self, user_id: str) -> dict[str, Any]:
        return await self.request("GET", f"/users/{user_id}/profile")

    # --- Bookings ---
    async def get_my_bookings(self, token: str, role: str = "renter") -> list[dict[str, Any]]:
        return await self.request("GET", "/bookings", token=token, params={"role": role})

    async def get_booking(self, token: str, booking_id: str) -> dict[str, Any]:
        return await self.request("GET", f"/bookings/{booking_id}", token=token)

    # --- Profile ---
    async def get_my_profile(self, token: str) -> dict[str, Any]:
        return await self.request("GET", "/users/me", token=token)


class UserSession:
    """Запросы от имени конкретного пользователя Telegram."""

    def __init__(self, api: KiroyaAPI, store: TokenStore, telegram_id: int) -> None:
        self.api = api
        self.store = store
        self.telegram_id = telegram_id

    async def is_authorized(self) -> bool:
        return await self.store.get_access(self.telegram_id) is not None

    async def call(self, method: str, path: str, **kwargs: Any) -> Any:
        token = await self.store.get_access(self.telegram_id)
        if token is None:
            raise AuthRequired
        try:
            return await self.api.request(
                method, path, token=token, telegram_id=self.telegram_id, **kwargs
            )
        except APIError as exc:
            if exc.status != 401:
                raise
        # access истёк (живёт 15 мин) — пробуем refresh один раз
        token = await self._refresh()
        try:
            return await self.api.request(
                method, path, token=token, telegram_id=self.telegram_id, **kwargs
            )
        except APIError as exc:
            if exc.status == 401:
                await self.store.clear(self.telegram_id)
                raise AuthRequired from exc
            raise

    async def _refresh(self) -> str:
        refresh_token = await self.store.get_refresh(self.telegram_id)
        if refresh_token is None:
            await self.store.clear(self.telegram_id)
            raise AuthRequired
        try:
            tokens = await self.api.refresh(refresh_token)
        except APIError as exc:
            await self.store.clear(self.telegram_id)
            raise AuthRequired from exc
        await self.store.save_access(self.telegram_id, tokens["access_token"])
        return str(tokens["access_token"])

    # Удобные обёртки
    async def me(self) -> dict[str, Any]:
        return await self.call("GET", "/users/me")

    async def bookings(self, role: str = "renter") -> list[dict[str, Any]]:
        return await self.call("GET", "/bookings", params={"role": role})

    async def booking(self, booking_id: str) -> dict[str, Any]:
        return await self.call("GET", f"/bookings/{booking_id}")
