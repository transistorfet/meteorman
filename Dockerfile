#FROM ulexus/meteor:build
FROM ulexus/meteor

ENV ROOT_URL=http://games.jabberwocky.ca/
ENV REPO=git://jabberwocky.ca/~git/pub/meteorman.git

ENV MONGO_URL=mongodb://localhost:27017/db
ENV MONGO_OPLOG_URL=mongodb://localhost:27017/local
 
