
'use strict';

if (Meteor.isClient) {

    window.GraphicsLib = {
        types: {
        },

        register: function (type, name, object) {
            object.name = name;
            object.type = type;
            GraphicsLib[name] = object;
            if (!(type in this.types))
                this.types[type] = { };
            this.types[type][name] = object;
        },

        use: function (type) {
            var name = Session.get('Graphics-'+type);
            if (!name)
                name = 'NoraShishi';
            var index = name.indexOf(':');
            var subset = (index >= 0) ? name.substr(index + 1) : '';
            name = (index >= 0) ? name.substr(0, index) : name;

            console.log('using', type, name, subset);
            return this.types[type][name].use(subset);
        },

        list: function (type) {
            var names = [ ];
            for (var i in this.types[type]) {
                if (this.types[type][i].SubSets) {
                    for (var j in this.types[type][i].SubSets)
                        names.push(i + ':' + this.types[type][i].SubSets[j]);
                }
                else
                    names.push(i);
            }
            return names;
        },
    };

    Template.registerHelper('useGraphicsSet', function (type) {
        return GraphicsLib.use(type);
    });

    Template.registerHelper('listGraphicsSets', function (type) {
        console.log(this, type);
        return GraphicsLib.list(type);
    });

    Template.registerHelper('currentGraphicsSet', function (type) {
        return Session.get('Graphics-'+type);
    });

    Template.registerHelper('isCurrentGraphicsSet', function (type, name) {
        return Session.get('Graphics-'+type) == name;
    });

    Template.GraphicsLibOptions.events({
        'change #graphics-options-set': function (event, template) {
            Session.set('Graphics-'+this.type, $(event.target).val());
        },
    });

    GraphicsLib.register('cardset', 'NoraShishi', {
        SubSets: [ 'trumps', 'royals' ],

        TileInfo: {
            'width': 32,
            'height': 48,
            'numx': 16,
            'numy': 4,
            'imgsrc': {
                trumps: "/graphics/NoraShishi/trumps_fixed.gif",
                royals: "/graphics/NoraShishi/royals_fixed.gif",
                kumpu: "/graphics/NoraShishi/kumpu_version.png",
            }
        },

        updateAll: function () {
            var self = this;
            $('.card').each(function () {
                var tile = $(this).attr('data-card');
                var x = (tile % self.TileInfo.numx) * self.TileInfo.width;
                var y = Math.floor(tile / self.TileInfo.numx) * self.TileInfo.height;
                $(this).css('background-position', '-' + x + 'px -' + y + 'px');
            });
        },

        use: function (subset) {
            var self = this;
            Tracker.afterFlush(function () {
                self.updateAll();
            });

            if (!subset)
                subset = 'trumps';
            return Spacebars.SafeString(
                '<style>#game-area .card {'+
                    'background-image: url("' + self.TileInfo.imgsrc[subset] + '");' +
                    'width: ' + self.TileInfo.width + 'px;' +
                    'height: ' + self.TileInfo.height + 'px;' +
                '}</style>');
        },
    });

    GraphicsLib.register('cardset', 'AisleRiot', {
        SubSets: [ 'Bonded', 'Guyenne', 'Paris' ],

        TileInfo: {
            'width': 79,
            'height': 123,
            'numx': 13,
            'numy': 5,
            'imgsrc': {
                Bonded: "/graphics/AisleRiot/bonded.svg",
                Guyenne: "/graphics/AisleRiot/guyenne-classic.svg",
                Paris: "/graphics/AisleRiot/paris.svg",
            }
        },

        updateCard: function (element, tile) {
            if (tile !== undefined)
                $(element).attr('data-card', tile);

            var tile = parseInt($(element).attr('data-card')) - 1;
            if (tile == 53) tile += 1;
            var x = (tile % this.TileInfo.numx) * this.TileInfo.width;
            var y = Math.floor(tile / this.TileInfo.numx) * this.TileInfo.height;
            $(element).css('background-position', '-' + x + 'px -' + y + 'px');
            //$(element).css('background-image', 'url("/graphics/AisleRiot/bonded.svg")');
            //$(element).css('width', this.TileInfo.width);
            //$(element).css('height', this.TileInfo.height);
        },

        use: function (subset) {
            var self = this;

            //Tracker.autorun(function () {
                //var reactive = Template.currentData();

                Tracker.afterFlush(function () {
                    console.log('updating in graphicslib');
                    $('.card').each(function () {
                        self.updateCard(this);
                    });
                });
            //});

            if (!subset)
                subset = 'Bonded';
            return Spacebars.SafeString(
                '<style>#game-area .card {'+
                    'background-image: url("' + this.TileInfo.imgsrc[subset] + '");' +
                    'width: ' + this.TileInfo.width + 'px;' +
                    'height: ' + this.TileInfo.height + 'px;' +
                '}</style>');
        }
    });

    //GraphicsLib.NoraShishi.constructor();

    /*
    GraphicsLib.register('cardset', 'GreyWyvern', {
        TileInfo: {
            'width': 90,
            'height': 135,
            'numx': 13,
            'numy': 5,
            'ranks': [ 'ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king' ],
        },

        updateCard: function (element, tile) {
            if (tile !== undefined)
                $(element).attr('data-card', tile);

            var tile = parseInt($(element).attr('data-card')) - 1;
            if (tile < 53) {
                var rank = this.TileInfo.ranks[tile % 13];
                var suit = Math.floor(tile / 13) + 1;
                $(element).css('background-image', 'url("/graphics/GreyWyvern/' + rank + suit + '.png")');
            }
            else if (tile == 53)
                $(element).css('background-image', 'url("/graphics/GreyWyvern/back1.png")');
        },

        use: function () {
            var self = this;
            Tracker.afterFlush(function () {
                console.log('updating in graphicslib');
                $('.card').each(function () {
                    self.updateCard(this);
                });
            });

            return Spacebars.SafeString(
                '<style>#game-area .card {'+
                    'width: ' + this.TileInfo.width + 'px;' +
                    'height: ' + this.TileInfo.height + 'px;' +
                '}</style>');
        },
    });
    */


        /*
        Template.GameArea.onCreated(function () {
            this.autorun(function () {
                var reactive = Template.currentData();

                Tracker.afterFlush(function () {
                    console.log('updating in graphicslib');
                    $('.card').each(function () {
                        updateCard(this);
                    });
                });
            });
        });
        */


}


