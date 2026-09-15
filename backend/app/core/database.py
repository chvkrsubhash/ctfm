"""
CTF Platform — MongoDB & Beanie Database Initialization
"""
import logging
from typing import Optional

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.models import ALL_DOCUMENT_MODELS

logger = logging.getLogger(__name__)

# Global client reference
motor_client: Optional[AsyncIOMotorClient] = None


async def init_db(client: Optional[AsyncIOMotorClient] = None, db_name: Optional[str] = None) -> None:
    """Initialize MongoDB connection and Beanie ODM."""
    global motor_client
    if client is not None:
        motor_client = client
    else:
        uri = settings.mongo_uri
        logger.info(f"Connecting to MongoDB at {uri[:25]}... (DB: {settings.MONGODB_DB_NAME})")
        motor_client = AsyncIOMotorClient(uri)

    database_name = db_name or settings.MONGODB_DB_NAME
    database = motor_client[database_name]

    await init_beanie(
        database=database,
        document_models=ALL_DOCUMENT_MODELS,
    )
    logger.info("Beanie initialized with all document models.")


async def close_db() -> None:
    """Close MongoDB connection."""
    global motor_client
    if motor_client:
        motor_client.close()
        logger.info("MongoDB connection closed.")


# Optional dummy session dependency for compatibility
async def get_db():
    yield None
