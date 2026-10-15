import asyncio
import logging
from app.market_data.service import market_data_service
from app.trading.engine import trading_engine
from app.core.config import settings

logger = logging.getLogger(__name__)

async def start_market_scheduler():
    """
    Background market refresh scheduler.
    Attempts quote updates every 5 minutes (configurable), updates stale states,
    and evaluates pending limit orders against newly arrived prices.
    """
    logger.info("Market data background refresh scheduler started.")
    
    # Run an initial lightweight refresh in background executor
    try:
        logger.info("Executing initial market quotes cache populate in executor...")
        loop = asyncio.get_event_loop()
        asyncio.wrap_future(loop.run_in_executor(None, market_data_service.refresh_universe_quotes, 5))
    except Exception as e:
        logger.warning(f"Initial market refresh encountered: {e}")

    while True:
        try:
            await asyncio.sleep(settings.REFRESH_INTERVAL_SECONDS)
            logger.info("Scheduler: Attempting 5-minute periodic quote refresh...")
            
            # Refresh universe quotes in background thread pool
            loop = asyncio.get_event_loop()
            res = await loop.run_in_executor(None, market_data_service.refresh_universe_quotes, 5)
            logger.info(f"Scheduler: Refresh complete. Updated {res.get('refreshed_count')}/{res.get('total')} instruments.")

            # Evaluate pending limit orders
            quotes_map = {}
            for q in market_data_service.get_all_quotes():
                if q.price is not None:
                    quotes_map[q.symbol] = q.price
                    
            executed = trading_engine.evaluate_pending_orders(quotes_map)
            if executed:
                logger.info(f"Scheduler: Executed {len(executed)} matching pending limit orders.")

        except asyncio.CancelledError:
            logger.info("Market scheduler task cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in market scheduler loop: {e}")
            await asyncio.sleep(30)
