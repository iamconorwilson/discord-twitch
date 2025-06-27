import type { HelixPaginatedEventSubSubscriptionsResult, HelixEventSubSubscription } from '@twurple/api';
import auth from '../functions/auth.js';
import * as dotenv from 'dotenv';

if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: '.env.development' });
} else {
  dotenv.config();
}

const authResult = await auth();

if (!authResult) {
  console.error('Failed to authenticate');
  process.exit(1);
}

const { apiClient } = authResult;


async function getAllSubscriptions() {
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

console.log('Fetching all subscriptions...');
const subscriptions = await getAllSubscriptions();
console.log(`Found ${subscriptions.length} subscriptions.`);

console.log('Deleting all subscriptions...');
for (const subscription of subscriptions) {
  try {
    await apiClient.eventSub.deleteSubscription(subscription.id);
    console.log(`Deleted subscription with ID: ${subscription.id}`);
  } catch (error) {
    console.error(`Failed to delete subscription with ID ${subscription.id}:`, error);
  }
}
