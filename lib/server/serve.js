
var fs = Npm.require('fs');
var path = Npm.require('path');

var mimetypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
}

ServeFile = function (basedir, relpath, response)
{
    var basedir = path.join(process.env.PWD, basedir);

    var file = fs.readFileSync(path.join(basedir, relpath));

    var headers = {
        'Content-type': mimetypes[path.extname(relpath)],
        'Content-Disposition': "attachment; filename=" + relpath
    };

    response.writeHead(200, headers);
    return response.end(file);
}

