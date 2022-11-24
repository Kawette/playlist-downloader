const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const puppeteer = require('puppeteer');

const spotify = new SpotifyWebApi({
    clientId: 'e0b6285c519a4de1af9233f895c0defb',
    clientSecret: 'd0e3963e674846c7a788dc958da7534b'
});

const musicPath = 'C:\\Users\\kawde\\Music\\All';

const main = async () => {

    // Auth
    console.log('Spotify auth...')
    const accessToken = (await (await spotify.clientCredentialsGrant()).body).access_token;
    spotify.setAccessToken(accessToken);

    // Spotify tracks
    console.log('Getting playlist tracks...')

    // Pagination get tacks spotify
        
    const tracks = [];
    let offset = 0;
    let total = 1;
    const limit = 100;
    while (offset < total) {
        const response = await spotify.getPlaylistTracks('6OSiHAG8CRAECVe7Tgha7m', { offset, limit });
        total = response.body.total;
        tracks.push(...response.body.items);
        offset += limit;
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Total playlist tracks : ${total}`);

    // const result = tracks.filter(({track}) => {
    //     return track.name.toLowerCase().includes('injection');
    // });
    // result.forEach(({track}) => {
    //     console.log(track.name);
    //     console.log(track.artists[0].name);
    // })
    // return;

    // Local tracks
    console.log('Getting local tracks...')
    const files = fs.readdirSync(musicPath);

    console.log(`Total local tracks : ${files.length}`);

    console.log('Resolving missing tracks...')
    const missingTracks = tracks.filter(({ track }) => {
        
        // Parsing track name & artist
        const trackName = normalize(track.name.split('-')[0])
        const trackArtist = normalize(track.artists[0].name)

        return !files.some(file => {
            // Parsing file name
            const normalizedFile = normalize(file.replace(/\.[^/.]+$/, ''));

            return normalizedFile.includes(trackName) && normalizedFile.includes(trackArtist)
        });
    });

    if(missingTracks.length === 0) {
        console.log('No missing tracks');
        return; 
    }

    console.log(`${missingTracks.length} tracks are missing :`);
    missingTracks.forEach(({ track }) => console.log(`${track.artists[0].name} - ${track.name}`));

    // Launching browser
    console.log('Search missing tracks on free-mp3-download.net...')
    const browser = await puppeteer.launch({ headless: false });

    for(const { track } of missingTracks) {

        // Load page
        const page = await browser.newPage();
        await page.bringToFront();
        await page.goto('https://www.free-mp3-download.net/');
        await page.click('#useVPN');

        // Find track
        await page.type('#q', `${track.artists[0].name} ${track.name.split('-')[0]}`)
        await page.click('#snd');
        page.setDefaultTimeout(2000);

        try {
            const trackItem = await page.waitForXPath(`//tr[contains(., "${track.name.split('-')[0]}")]`);
            const goToDownloadButton = await trackItem.$('.btn');
            await goToDownloadButton.click();
    
            // Use FLAC if available
            const flacLabel = await page.waitForXPath('//label[contains(., "FLAC")]');
            await flacLabel.click();
    
            // Download
            const downloadButton = await page.waitForXPath('//button[contains(., "Download")]');
            await page.waitForTimeout(100);
    
            // Ask for captcha
            await downloadButton.click();
            while (!await isCaptchaSolved(page)) {
                console.log('You must solve the captcha ! (You have 10s)');
                await page.waitForTimeout(10000);
                await downloadButton.click();
            }
        } catch (error) {
            console.log(`Track not found: ${track.name}`);
        }
    };
}

const isCaptchaSolved = async (page) => {
    try {
        await page.waitForXPath('//button[contains(., "Downloading")]');
        return true;
    } 
    catch (error) {
        return false;
    }
}

const normalize = (string) => 
    string.toLowerCase()
        .replaceAll("'", '')
        .replaceAll('"', '')
        .replaceAll('/', '')
        .replaceAll('?', '')
        .replaceAll('̈', '')
        .replaceAll(':', '')
        .replaceAll('!', '')
        .replaceAll('-', '')
        .replaceAll('_', '')
        .replaceAll('(', '')
        .replaceAll(')', '')
        .replaceAll('[', '')
        .replaceAll(']', '')
        .replaceAll('{', '')
        .replaceAll('}', '')
        .replaceAll(';', '')
        .replaceAll('’', '')
        .replaceAll('*', '')
        .normalize('NFD').replaceAll(/[\u0300-\u036f]/g, "")
        .trim()

main();