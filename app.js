import { AppTokenAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { EnvPortAdapter, EventSubHttpListener } from '@twurple/eventsub-http';
import { NgrokAdapter } from '@twurple/eventsub-ngrok';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';


if (process.env.NODE_ENV === 'development') {
    dotenv.config({ path: '.env.development' });
} else {
    dotenv.config();
}
console.log('Starting TwitchBot');

console.log(process.env.NODE_ENV);

const channelsPath = path.resolve(process.cwd(), process.env.CHANNELS_PATH);

//if channels.json does not exist, error
if (!existsSync(channelsPath)) {
    console.error('No channels.json found. Please create one.');
    console.log(channelsPath);
    process.exit(1);
}

const channels = JSON.parse(readFileSync(channelsPath, 'utf-8'));

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

const authProvider = new AppTokenAuthProvider(clientId, clientSecret);

const apiClient = new ApiClient({ authProvider });

console.log('API client created');

console.log(process.env.HOSTNAME);

// for each channel in channels.json listen for stream online events
let adapter;

if (process.env.NODE_ENV === 'development') {

    await apiClient.eventSub.deleteAllSubscriptions();

    adapter = new NgrokAdapter({
        ngrokConfig: {
            authtoken: process.env.NGROK_AUTH_TOKEN,
        }
    });
} else {

    adapter = new EnvPortAdapter({
        hostName: process.env.HOSTNAME
    })
}
const listener = new EventSubHttpListener({
    apiClient,
    adapter,
    secret: process.env.EVENTSUB_SECRET
});

console.log('Registering channels');

for (const channel of channels) {

    let channelId;

    try {
        channelId = await apiClient.users.getUserByName(channel).then((user) => { return user.id });
    } catch (error) {
        console.error(`Failed to get channel ID for ${channel}`);
        console.error(error);
        continue;
    }

    console.log(`Registering channel: ${channel} (${channelId})`);

    listener.onStreamOnline(channelId, async (event) => {
        console.log(`Stream is online for ${event.broadcasterDisplayName}`);
        await sendWebhook(event);
    });
}


console.log('Listening for events');

listener.start();


const sendWebhook = async (event) => {

    const username = event.broadcasterDisplayName;
    const stream = await event.getStream();
    const broadcaster = await event.getBroadcaster();
    const streamTitle = stream.title;
    const streamCategory = stream.gameName;
    const streamUrl = `https://twitch.tv/${event.broadcasterName}`;
    const streamThumbnail = stream.thumbnailUrl.replace('{width}', '1280').replace('{height}', '720');
    const userThumbnail = broadcaster.profilePictureUrl;

    const message = {
        content: `${username} just went live at ${streamUrl}!`,
        type: "rich",
        tts: false,
        embeds: [
            {
                description: "",
                fields: [
                    {
                        name: "Game",
                        value: `${streamCategory}`,
                        inline: false
                    }
                ],
                title: `${streamTitle}`,
                author: {
                    name: `${username}`,
                    icon_url: `${userThumbnail}`

                },
                url: `${streamUrl}`,
                image: {
                    url: `${streamThumbnail}`
                },
                timestamp: new Date().toISOString(),
                color: 9520895
            }
        ],
        username: "TwitchBot"
    }

    console.log(JSON.stringify(message));

    try {
        const response = await axios.post(webhookUrl, message);
        //log response code and message
        console.log(response.status, response.statusText);
    } catch (error) {
        console.error(error);
    }
}