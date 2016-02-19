
'use strict';

if (Meteor.isClient) {
    var TileInfo = {
        'width': 32,
        'height': 48,
        'numx': 16,
        'numy': 4
    }

    var PlayArea = (function ()
    {
        var Constructor = function ()
        {
            return this;
        }

        var Proto = Constructor.prototype;

        Proto.update_tile = function (element, tile)
        {
            if (tile !== undefined)
                $(element).attr('data-card', tile);

            var tile = $(element).attr('data-card');
            var x = (tile % TileInfo.numx) * TileInfo.width;
            var y = Math.floor(tile / TileInfo.numx) * TileInfo.height;
            $(element).css('background-position', '-' + x + 'px -' + y + 'px');
        }

        return Constructor;
    })();


    Template.Games_Blackjack.onCreated(function ()
    {
        var instance = this;
        var playarea = new PlayArea();

        instance.autorun(function () {
            var thing = Template.currentData();

            Tracker.afterFlush(function () {
                console.log("blackjack rerun");
                $('.card').each(function ()
                {
                    playarea.update_tile(this);
                });
            });
        });

    });

    Template.Games_Blackjack.events({
        'click #hit': function () {
            Meteor.call('action', this._id, 'hit');
        },
        'click #stay': function () {
            Meteor.call('action', this._id, 'stay');
        },
        'click #next': function () {
            Meteor.call('action', this._id, 'next');
        },
    });
}

if (Meteor.isServer) {

    var Game = Object.create({
        init: function (self) {
            console.log('init blackjack');
            self.state.wins = 0;
            self.state.losses = 0;

            Game.startRound(self);

            GameLib.updateState(self._id, self.state);
        },

        finish: function (self) {
            console.log('finish blackjack');
        },

        action: function (self, action, args) {

            if (self.state.playing) {
                if (action == 'hit') {
                    GameLib.log(self._id, "player requested a hit");
                    self.state['player'].push(self.state['deck'].shift());
                    var score = Game.calculateScore(self.state.player);
                    if (score > 21)
                        Game.endRound(self);
                }
                else if (action == 'stay') {
                    GameLib.log(self._id, "player requested to stay");
                    Game.endRound(self);
                }
            }
            else {
                if (action == 'next') {
                    GameLib.log(self._id, "starting new round");
                    Game.startRound(self);
                }
            }

            GameLib.updateState(self._id, self.state);
        },

        startRound: function (self) {
            self.state['deck'] = Array(52).fill().map(function (current, index, array) { return index + 1; });
            GameLib.shuffle(self.state['deck']);

            self.state['dealer'] = [ ];
            self.state['player'] = [ ];

            Game.dealCard(self, 'player');
            Game.dealCard(self, 'dealer');
            Game.dealCard(self, 'player');
            Game.dealCard(self, 'dealer');

            self.state.playing = true;
            self.state.message = '';
        },

        endRound: function (self) {
            self.state['playing'] = false;

            var player_score = Game.calculateScore(self.state.player);

            var dealer_score;
            while (true) {
                dealer_score = Game.calculateScore(self.state.dealer);
                if (player_score > 21 || dealer_score >= 17)
                    break;
                Game.dealCard(self, 'dealer');
            }

            if (player_score > 21) {
                self.state.losses += 1;
                self.state.message = "Bust! Dealer Wins";
            }
            else if (dealer_score > 21) {
                self.state.wins += 1;
                self.state.message = "Dealer Busts!  You Win";
            }
            else if (player_score > dealer_score) {
                self.state.wins += 1;
                self.state.message = "You Win!";
            }
            else {
                self.state.losses += 1;
                self.state.message = "Dealer Wins";
            }

            GameLib.log(self._id, self.state.message);
        },

        dealCard: function (self, handname) {
            self.state[handname].push(self.state['deck'].shift());
        },

        calculateScore: function (hand) {
            var score = 0;
            var aces = 0;

            for (var i in hand) {
                var card = Math.min(10, ((hand[i] - 1) % 13) + 1);
                if (card == 1)
                    aces += 1;
                else
                    score += card;
            }

            for (var i = 0; i < aces; i++) {
                if (score + 11 <= 21)
                    score += 11;
                else
                    score += 1;
            }

            return score;
        },

        getPlayerView: function (self) {
            var view = {
                playing: self.state.playing,
                player: self.state.player,
                player_score: Game.calculateScore(self.state.player),
                wins: self.state.wins,
                losses: self.state.losses,
                message: self.state.message,
            };

            if (self.state.playing) {
                view.dealer = [ self.state.dealer[0], 54 ];
            }
            else {
                view.dealer = self.state.dealer;
                view.dealer_score = Game.calculateScore(self.state.dealer);
            }

            return view;
        },
    });

    GameLib.Types.add({
        name: 'blackjack',
        title: 'Blackjack',
        template: 'Games_Blackjack',
        methods: Game,
        maxslots: 1,
    });
}


