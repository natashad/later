if (Meteor.isServer) {

  extractMeta = function (url) {
    var html;

    try {
      var result = HTTP.call('GET', url);
      if(result.statusCode !== 200) {
        console.log("Bad HTTP Status of " + result.statusCode +  "from: " + url);
        return {};
      }

      if(result.headers['content-type']) {
        if(result.headers['content-type'].indexOf('image') === 0) {
          return {
            type: 'image',
            image: url
          };
        } else if(result.headers['content-type'].indexOf('text/html') === 0) {
          html = result.content;
        } else {
          console.log("Unknown content type: " + result.headers['content-type']);
        }
      }
    } catch (e) {
      console.log("Error: " + e);
      return {};
    }

    if(!html) {
      return {};
    }

    var cheerio = Meteor.npmRequire('cheerio');
    var meta = {};
    $ = cheerio.load(html);

    $('head meta').each(function(i) {
      var prop = $(this).attr("property");
      var content = $(this).attr("content");
      if(prop && content) {
        if(prop === 'og:description') meta.description = content;
        else if(prop === 'og:image') meta.image = content;
        else if(prop === 'og:title') meta.title = content;
        else if(prop === 'og:type') meta.type = content;
      }
    });

    return meta;
  };

}