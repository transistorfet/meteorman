
'use strict';

if (Meteor.isClient) {
    Template.registerHelper('equals', function (arg1, arg2) {
        return (arg1 == arg2);
    });

    Template.registerHelper('isUserId', function (userId) {
        return (userId == Meteor.userId());
    });

    Template.registerHelper('truncate', function (value, length) {
        return value.substring(0, length);
    });

    Template.registerHelper('formatDate', function (timestamp) {
        var date = new Date(timestamp * 1000);
        return date.toDateString();
    });
}
 
