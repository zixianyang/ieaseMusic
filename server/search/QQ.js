
import _debug from 'debug';
import chalk from 'chalk';

const debug = _debug('dev:plugin:QQ');
const error = _debug('dev:plugin:QQ:error');

let rp;

async function getSong(mid) {
    var currentMs = (new Date()).getUTCMilliseconds();
    var guid = Math.round(2147483647 * Math.random()) * currentMs % 1e10;
    var file = await genKey(mid);
    var response = file
        ? (
            await rp({
                uri: 'https://c.y.qq.com/base/fcgi-bin/fcg_music_express_mobile3.fcg',
                qs: {
                    cid: '205361747',
                    uin: 0,
                    songmid: mid,
                    filename: genFilename(file, mid),
                    format: 'json',
                    guid: guid.toString(),
                },
            })
        )
        : {}
    ;

    if (
        false
        || response.code !== 0
        || response.data.items.length === 0
    ) {
        return {};
    }

    const key = response.data.items[0].vkey;

    if (!key) {
        throw Error('Invalid Key.');
    }

    if (file.size_flac) {
        return {
            isFlac: true,
            src: getURL(`F000${mid}.flac`, key, guid),
        };
    }

    if (file.size_320mp3) {
        return {
            bitRate: 320000,
            src: getURL(`M800${mid}.mp3`, key, guid),
        };
    }

    if (file.size_128mp3) {
        return {
            bitRate: 128000,
            src: getURL(`M500${mid}.mp3`, key, guid),
        };
    }
}

function genFilename(file, mid) {
    var prefix = 'C400';

    switch (true) {
        case file.size_flac:
            prefix = 'F000';
            break;

        case file.size_320mp3:
            prefix = 'M800';
            break;

        case file.size_128mp3:
            prefix = 'M500';
            break;
    }

    return `${prefix}${mid}.m4a`;
}

async function genKey(mid) {
    var response = await rp({
        uri: 'http://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg',
        qs: {
            songmid: mid,
            format: 'json',
        },
    });
    var data = response.data;

    if (response.code !== 0
        || data.length === 0) {
        return false;
    }

    return data[0]['file'];
}

function getURL(filename, key, guid) {
    return `http://dl.stream.qqmusic.qq.com/${filename}?vkey=${key}&guid=${guid}&fromtag=53`;
}

export default async(request, keyword, artists) => {
    debug(chalk.black.bgGreen('💊  Loaded QQ music.'));

    rp = request;

    try {
        var response = await rp({
            uri: 'http://c.y.qq.com/soso/fcgi-bin/search_cp',
            qs: {
                w: [keyword].concat(artists.split(',')).join('+'),
                p: 1,
                n: 100,
                aggr: 1,
                lossless: 1,
                cr: 1,
                format: 'json',
                inCharset: 'utf8',
                outCharset: 'utf-8'
            },
        });

        var data = response.data;

        if (response.code !== 0
            || data.song.list.length === 0) {
            error(chalk.black.bgRed('🚧  Nothing.'));
            return Promise.reject();
        }

        for (let e of data.song.list) {
            let song = {};

            // Match the artists
            if (e.singer.find(e => artists.indexOf(e.name) === -1)) {
                continue;
            }

            song = await getSong(e.media_mid);

            if (!song.src) {
                error(chalk.black.bgRed('🚧  Nothing.'));
                return Promise.reject();
            }

            debug(chalk.black.bgGreen('🚚  Result >>>'));
            debug(e);
            debug(chalk.black.bgGreen('🚚  <<<'));

            return song;
        }
    } catch (ex) {
        error('Failed to get song: %O', ex);
        return Promise.reject();
    }

    error(chalk.black.bgRed('🈚  Not Matched.'));
    return Promise.reject();
};
