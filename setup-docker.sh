docker run --name meteorman \
	-e PORT=9000 \
	-p 9000:9000 \
	-e ROOT_URL=http://games.jabberwocky.ca/ \
	-e MAIL_URL=smtp://jabberwocky.ca:25/ \
	-e REPO=git://jabberwocky.ca/~git/pub/meteorman.git \
	-e MONGO_URL=mongodb://192.168.1.101:27017/db \
	-d ulexus/meteor:build
#	-e MONGO_OPLOG_URL=mongodb://192.168.1.101:27017/local \
