
'use strict';

var Global = Meteor.isClient ? window : global;

Global.GameState = new Mongo.Collection('gamestate');

if (Meteor.isServer) {
    Global.GameState.deny({
        insert: function() {
            return true;
        },
        update: function() {
            return true;
        },
        remove: function() {
            return true;
        },
    });
}

