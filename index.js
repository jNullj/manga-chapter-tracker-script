const MFA = require('mangadex-full-api');
// hate globals
// but... its cheap and dirty but gets the job done
// time limitation for writing this was tight
var my_groups;
var my_chapters = [];
var my_manga = [];
var http = require('http');
var server = undefined;

function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

function clearGlobals(){
	// its cheap and dirty but gets the job done
    my_groups = undefined;
    my_chapters = [];
    my_manga = [];
    server.close();
    // server.closeAllConnections(); for future release with node.js 18.2+
    server = undefined;
}


function entrypoint() {
	// to generate the rss feed 3 datasets are required:
	//   1. all user groups with respecive ids
	//   2. all chapters translated by said groups
	//   3. all manga names for those chapters, linked by id in the chapter object
	
	// login and provide cache directory
    MFA.login( 'USERNAME', 'PASSWORD', 'ABSULOTE/PATH/TO/DIR/FOR/TEMP/FILES').then(() => {
		// first get user groups
        MFA.Group.getFollowedGroups().then(async (results) => {
            console.log('found groups:' + results.length)
            my_groups = results;	
            for (group of results) {
				// second search translated chapter per group
                let chap = await MFA.Chapter.search({groups: [group.id], limit: 80, translatedLanguage: ['en'], order: {readableAt: 'desc'}})
                my_chapters = my_chapters.concat(chap);
                console.log('added chapters from group: '+group.name)
            }
        }).then(async () => {
			// once we got all groups find uniqe manga ids
            function temp(){
                console.log('done with chapters')
                var manga_id_arr = [];
                my_chapters.forEach(val => {
                    let myid = val.manga.id;
                    manga_id_arr.push(myid);
                })
                return manga_id_arr.filter(onlyUnique);
            }
            var uniqeu_manga_id_arr = await temp();
			// use the manga id to get results for everything using one call
            let newManga = await MFA.Manga.getMultiple(uniqeu_manga_id_arr);
            my_manga = my_manga.concat(newManga)
        }).then(() => {
			// now we have all data needed, its time to generate the rss feed
            console.log('to xml we go')
            var final_feed = generateRss(my_chapters, my_manga, my_groups);
			// for easy interface for the rss client used in this case, a tiny http server serves the feed
			// one could save as a file for a client or to server in another server (like apache or ngix)
            console.log('finished xml feed generation - starting http server')
            server = http.createServer(function (req, res) {
				// generated feed once earlier, send it on every request
                res.write(final_feed); //write a response to the client
                res.end(); //end the response
            })
            server.listen(8080); // the server listens on port 8080, pick your fav port
            console.log('server alive for the next 6 hours')
        }).catch(console.error);
    }).catch(console.error);
}

// building rss feed using rss package, trivial stuff
function generateRss(chapters,mangas,groups){
    var RSS = require('rss');
    var feed = new RSS({
        title: 'Mangadex groups updates',
        description: 'the best rss feed ever',
        managingEditor: 'jnullj@github',
        webMaster: 'jnullj@github',
        language: 'en'
    })
	// this feed shows manga name as title and chapter name as description
    chapters.forEach(chap => {
        let manga_id = chap.manga.id;
        let manga_obj = my_manga.filter(obj => {
            return obj.id === manga_id;
        })[0]
        let my_title = manga_obj.title;
        let group_obj = groups.filter(obj => {
            // there might be multiple groups per chapter
            // not all of them are followed by the user
            // per user request, one group is required, no priority for one over another
            res = false;
            chap.groups.forEach(chapgroup => {
                // look for first group that fit groups the user follows
                if (obj.id === chapgroup.id) {
                    res = true;
                }
            })
            return res;
        })[0]
		// add one item, be happy, repeat
        feed.item({
            title: my_title,
            description: 'Vol.'+chap.volume+' Ch.'+chap.chapter+' '+chap.title,
            url: 'https://mangadex.org/title/' + manga_id,
            author: group_obj.name,
            date: chap.publishAt
        })
    })

    var xml = feed.xml();
    return xml;
}

entrypoint();	// setInterval first run is after the interval passed once, triger once to get started right away
// every 6 hours the whole trick runs fresh and updates the rss feed to latest info and the best of anime
setInterval(() => {
    console.log('clearning globals and restarting server')
    clearGlobals();
    entrypoint();
},
1000 * 60 * 60 * 6) // every 6 hours refresh everything