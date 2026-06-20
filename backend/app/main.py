from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, users, stations, carts, rental_requests, messages, reservations, reviews, notifications
from app.services.reminder_service import run_reminders

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(run_reminders, "interval", minutes=10, id="reminders")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="DaiShare API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(stations.router)
app.include_router(carts.router)
app.include_router(rental_requests.router)
app.include_router(messages.router)
app.include_router(reservations.router)
app.include_router(reviews.router)
app.include_router(notifications.router)


@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.environment}
