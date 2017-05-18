
//UserData = new Mongo.Collection('userdata');

if (Meteor.isClient) {
    Accounts.ui.config({
        passwordSignupFields: 'USERNAME_AND_EMAIL',
    });
}

if (Meteor.isServer) {
    process.env.MAIL_URL = 'smtp://0.0.0.0:25/';

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
        user.profile.createdAt = Date.now() / 1000;
        user.profile.notifications = [ ];
        user.profile.friends = [ ];

        return user;
    });

    Accounts.getUsername = function (userId) {
        var user = Meteor.users.findOne({ _id: userId }, { fields: { username: 1 } });
        return (user && user.username) ? user.username : 'unknown';
    };
}

