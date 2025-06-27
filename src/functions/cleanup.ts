import type { ApiClient, HelixEventSubSubscription, HelixPaginatedEventSubSubscriptionsResult } from '@twurple/api';
import type { EventSubHttpListener } from '@twurple/eventsub-http';

const getAllSubscriptions = async (apiClient: ApiClient): Promise<HelixEventSubSubscription[]> => {
  let allSubscriptions: HelixEventSubSubscription[] = [];
  let currentCursor = '';
  let hasMore = true;

  while (hasMore) {
    try {
      const response: HelixPaginatedEventSubSubscriptionsResult = await apiClient.eventSub.getSubscriptions({ after: currentCursor });
      allSubscriptions = allSubscriptions.concat(response.data);

      if (response.cursor) {
        currentCursor = response.cursor;
      } else {
        hasMore = false; // No more cursor, so no more pages
      }
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      hasMore = false; // Stop if an error occurs
    }
  }

  return allSubscriptions;
}


const deleteAllSubscriptions = async (apiClient: ApiClient): Promise<void> => {

  console.log('Deleting all subscriptions...');
  const subscriptions = await getAllSubscriptions(apiClient);
  console.log(`Found ${subscriptions.length} subscriptions.`);

  if (subscriptions.length === 0) {
    return;
  }

  console.log('Deleting all subscriptions...');
  const deletionPromises = subscriptions.map(async (subscription, index) => {
    try {
      await apiClient.eventSub.deleteSubscription(subscription.id);
      console.log(`Deleted subscription ${index + 1} of ${subscriptions.length} (ID: ${subscription.id})`);
    } catch (error) {
      console.error(`Failed to delete subscription with ID ${subscription.id}:`, error);
    }
  });
  await Promise.allSettled(deletionPromises);
}

// before exiting the process, clean up subscriptions
const setCleanup = (apiClient: ApiClient, listener: EventSubHttpListener, interval: NodeJS.Timeout) => {

  const cleanupAndExit = async () => {
    console.log('Received signal to shut down. Starting cleanup...');
    try {
      await deleteAllSubscriptions(apiClient);
      listener.stop();
      clearInterval(interval);
    } catch (error) {
      console.error('An error occurred during cleanup:', error);
      process.exit(1);
    } finally {
      console.log('Cleanup complete. Exiting process.');
      process.exit(1);
    }
  };

  process.on('SIGINT', cleanupAndExit);
  process.on('SIGTERM', cleanupAndExit);

  // Add an uncaught exception handler as a fallback for unexpected errors
  process.on('uncaughtException', async (err) => {
    console.error('Uncaught Exception:', err);
    await cleanupAndExit(); // Attempt cleanup then exit
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await cleanupAndExit(); // Attempt cleanup then exit
  });
}

export { setCleanup, deleteAllSubscriptions }