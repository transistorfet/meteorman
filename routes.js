
if (Meteor.isClient) {
    Router.configure({
        layoutTemplate: 'Base'
    });

    Router.route('/', function () {
        this.render('Home');
    });
}

