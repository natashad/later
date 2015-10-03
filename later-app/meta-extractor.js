if (Meteor.isServer) {

  extractMeta = function (params) {
    var html;
    var meta = {};

    try {
      var result = HTTP.call('GET', params);
      if(result.statusCode !== 200) {
        return {};
      }
      html = result.content;
    } catch (e) {
      return {};
    }

    var cheerio = Meteor.npmRequire('cheerio');
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