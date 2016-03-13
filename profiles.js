
//UserData = new Mongo.Collection('userdata');

if (Meteor.isClient) {
    Meteor.subscribe('MyFriendList');

    // View User Profile
    Router.route('/profile/:userId', {
        waitOn: function () {
            this.subscribe('UserProfilePublic', this.params.userId);
            this.subscribe('UserProfileFriendOnly', this.params.userId);
        },
        action: function () {
            var data = Meteor.users.findOne({ _id: this.params.userId });
            this.render('Profile', { data: data });
        },
    });

    Template.Profile.events({
        'click .profile-add-friend': function (event, template) {
            var friendId = $(event.target).attr('data-id');
            var friend = Meteor.users.findOne({ _id: friendId });
            Meteor.call('addFriend', $(event.target).attr('data-id'), function (error, result) {
                if (result)
                    FlashMessages.sendSuccess("A friend request has been sent to " + friend.username);
                else
                    FlashMessages.sendError("An error occured while sending friend request to " + friend.username);
            });
        },
    });

    Template.ProfileFriendsList.events({
        'click .profile-remove-friend': function (event, template) {
            var friendId = $(event.target).attr('data-id');
            var friend = Meteor.users.findOne({ _id: friendId });
            Meteor.call('removeFriend', friendId, function (error, result) {
                if (result)
                    FlashMessages.sendSuccess(friend.username + " unfriended");
                else
                    FlashMessages.sendError("An error occured while unfriending " + friend.username);
            });
        },
    });

    Template.ProfileNotificationsList.events({
        'click .profile-notification-dismiss': function (event, template) {
            Meteor.call('dismissNotification', $(event.target).attr('data-id'));
        },

        'click .profile-approve-friend': function (event, template) {
            var friendId = $(event.target).attr('data-id');
            var friend = Meteor.users.findOne({ _id: friendId });
            Meteor.call('approveFriend', friendId, function (error, result) {
                if (result)
                    FlashMessages.sendSuccess("You are now friends with " + friend.username);
                else
                    FlashMessages.sendError("An error occured while approving " + friend.username);
            });
        },
    });

    Template.registerHelper('listMyNotifications', function () {
        var user = Meteor.user();
        if (!user)
            return false;

        var notes = [ ];
        for (var i in user.profile.notifications) {
            var note = user.profile.notifications[i];
            if (note.type == 'friend-request') {
                var username = Meteor.call('getUsername', note.userId);
                notes.push({
                    noteId: note.noteId,
                    message: username + " wants to be friends.",
                    action: '<button class="profile-approve-friend" data-id="' + note.userId + '">Accept</button>',
                });
            }
            else {
                notes.push({
                    noteId: note.noteId,
                    message: "Unknown notification: " + note.type,
                });
            }
        }
        return notes;
    });


    // Edit Profile
    Router.route('/settings', function () {
        var data = Meteor.users.findOne({ _id: Meteor.userId() });
        this.render('ProfileSettings', { data: data });
    });

    Template.ProfileSettings.events({
        'click #settings-cancel': function (event, template) {
            Router.go('/profile/' + Meteor.userId());
        },

        'click #settings-save': function (event, template) {
            var fields = [ 'firstName', 'lastName', 'email' ];

            var postvars = { };
            for (var i in fields) {
                postvars[fields[i]] = $('input[name="' + fields[i] + '"]').val();
            }

            console.log(postvars);
            Meteor.call('updateProfile', postvars, function (error, result) {
                if (result)
                    FlashMessages.sendSuccess("Profile updated successfully");
                else
                    FlashMessages.sendError("An error occurred while updating your profile");
            });
        },

        'click #settings-change-pass': function (event, template) {
            var oldPassword = $('input[name="oldPassword"]').val();
            var newPassword = $('input[name="newPassword"]').val();
            var retypePassword = $('input[name="retypePassword"]').val();

            console.log(oldPassword, newPassword, retypePassword);
            if (newPassword && newPassword == retypePassword) {
                Accounts.changePassword(oldPassword, newPassword, function () {
                    FlashMessages.sendSuccess("Password changed successfully");
                    $('input[name="oldPassword"]').val('');
                    $('input[name="newPassword"]').val('');
                    $('input[name="retypePassword"]').val('');
                });
            }
            else
                FlashMessages.sendError("Those passwords don't match");
        },
    });

    Template.registerHelper('isFriend', function (friendId) {
        if (!Meteor.user())
            return false;

        var friends = Meteor.user().profile.friends;
        for (var i in friends) {
            if (friends[i] == friendId)
                return true;
        }
        return false;
    });

    Template.registerHelper('listMyFriends', function () {
        if (!Meteor.user())
            return false;
        return Meteor.users.find({ _id: { $in: Meteor.user().profile.friends } }).fetch();
    });

    Template.registerHelper('listUserFriends', function () {
        if (!this.profile || !this.profile.friends)
            return;
        return Meteor.users.find({ _id: { $in: this.profile.friends } }).fetch();
    });

}

if (Meteor.isServer) {
    /*
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
    */

    Meteor.publish('UserProfilePublic', function (userId) {
        return Meteor.users.find({ _id: userId }, { fields: { username: 1, 'profile.firstName': 1, 'profile.lastName': 1, 'profile.createdAt': 1 } });
    });

    Meteor.publish('UserProfileFriendOnly', function (userId) {
        var user = Meteor.users.find({ _id: userId, 'profile.friends': { $in: [ this.userId ] } }, { fields: { 'profile.friends': 1 } });
        if (!user.count())
            return undefined;
        var data = user.fetch()[0];
        //var friends = Meteor.users.find({ $in: { _id: data.profile.friends } }, { fields: { username: 1 } });
        var games = GameState.find({ users: { $in: [ userId ] } }, { fields: { createdAt: 1, options: 1, started: 1 } });
        console.log('states', games.fetch());
        return [ user, games ];
    });

    Meteor.publish('MyFriendList', function() {
        var user = Meteor.users.findOne({ _id: this.userId }, { fields: { 'profile.friends': 1 } });
        return Meteor.users.find({ _id: { $in: user.profile.friends } }, { username: 1 });
    });

    Meteor.methods({
        updateProfile: function (postvars) {
            var user = Meteor.user();
            var profile = user.profile

            var fields = [ 'firstName', 'lastName' ];
            for (var i in fields) {
                if (fields[i] in postvars)
                    profile[fields[i]] = postvars[fields[i]];
            }
            Meteor.users.update({ _id: user._id }, { $set: { profile: profile } });

            if ('email' in postvars && (!user.emails.length || user.emails[0].address != postvars.email)) {
                if (user.emails.length)
                    Accounts.removeEmail(user._id, user.emails[0].address);
                Accounts.addEmail(user._id, postvars.email);
            }
            return true;
        },

        addFriend: function (friendId) {
            if (Meteor.users.findOne({ _id: friendId, $or: [ { 'profile.friends': { $in: [ Meteor.userId() ] } }, { 'profile.notifications': { $elemMatch: { type: 'friend-request', userId: Meteor.userId() } } } ] }))
                return true;

            /*
            var notify = {
                noteId: Random.id(),
                type: 'friend-request',
                userId: Meteor.userId(),
            };

            if (!Meteor.users.update({ _id: friendId }, { $push: { 'profile.notifications': notify } }))
                return false;
            */

            return Notifications.send(friendId, 'friend-request', Meteor.userId());
        },

        approveFriend: function (friendId) {
            var userId = Meteor.userId();

            if (Meteor.users.findOne({ _id: friendId, 'profile.friends': { $in: [ userId ] } }))
                return true;

            if (!Meteor.users.update({ _id: friendId }, { $push: { 'profile.friends': userId } }))
                return false;
            if (!Meteor.users.update({ _id: userId }, { $push: { 'profile.friends': friendId } }))
                return false;

            /*
            Meteor.users.update({ _id: friendId }, { $push: { 'profile.notifications': {
                noteId: Random.id(),
                type: 'friend-approved',
                userId: userId,
            } } });
            */
            Notifications.send(friendId, 'friend-approved', userId);

            //Meteor.users.update({ _id: Meteor.userId() }, { $pull: { 'profile.notifications': { type: 'friend-request', userId: friendId } } })
            Notifications.clear(userId, 'friend-request', friendId);
            return true;
        },

        removeFriend: function (friendId) {
            if (!Meteor.users.update({ _id: Meteor.userId() }, { $pull: { 'profile.friends': friendId } }))
                return false;
            if (!Meteor.users.update({ _id: friendId }, { $pull: { 'profile.friends': Meteor.userId() } }))
                return false;
            return true;
        },

        dismissNotification: function (noteId) {
            //Meteor.users.update({ _id: Meteor.userId() }, { $pull: { 'profile.notifications': { noteId: noteId } } })
            Notifications.dismiss(Meteor.userId(), noteId);
        },

        getUsername: function (userId) {
            var user = Meteor.users.findOne({ _id: userId }, { fields: { username: 1 } });
            if (user)
                return user.username;
            return 'unknown-user';
        },

    });

    global.Notifications = {
        send: function (userId, type, paramUserId) {
            return Meteor.users.update({ _id: userId }, { $push: { 'profile.notifications': {
                noteId: Random.id(),
                type: type,
                userId: paramUserId,
            } } });
        },

        dismiss: function (userId, noteId) {
            Meteor.users.update({ _id: userId }, { $pull: { 'profile.notifications': { noteId: noteId } } })
        },

        clear: function (userId, type, paramUserId) {
            Meteor.users.update({ _id: userId }, { $pull: { 'profile.notifications': { type: type, userId: paramUserId } } })
        },
    };
}

