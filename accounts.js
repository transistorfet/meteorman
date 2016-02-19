
UserData = new Mongo.Collection('userdata');

if (Meteor.isClient) {
    Accounts.ui.config({
        passwordSignupFields: 'USERNAME_AND_EMAIL',
    });

    Router.route('/profile/:userId', function () {
        var data = Meteor.users.findOne({ _id: this.params.userId });
        this.render('Profile', { data: data });
    });
}

if (Meteor.isServer) {
    process.env.MAIL_URL = 'smtp://localhost:25/';

    Accounts.config({
        sendVerificationEmail: true,
        forbidClientAccountCreation: false,
    });

    Meteor.users.deny({
        update: function() {
            return true;
        },
        remove: function() {
            return true;
        },
    });

    Accounts.onCreateUser(function(options, user) {
        console.log(options, user);
        user.profile = options.profile || {};

        user.profile.firstName = options.firstName;
        user.profile.lastName = options.lastName;
        user.profile.friends = [ ];

        return user;
    });
}

