
var Global = Meteor.isClient ? window : global;

Global.GameUtils = {
    randomName: function () {
        return RandomNames[Math.floor(Math.random() * RandomNames.length)];
    },

    formatTime: function (date) {
        var hours = date.getHours();
        var minutes = date.getMinutes();
        if (hours < 10)
            hours = '0' + hours;
        if (minutes < 10)
            minutes = '0' + minutes;
        return hours + ':' + minutes;
    },

    shuffle: function (array) {
        var j, temp;

        for (var i = array.length - 1; i > 0; i -= 1) {
            j = Math.floor(Math.random() * (i + 1))
            temp = array[i]
            array[i] = array[j]
            array[j] = temp
        }
    },
};

if (Meteor.isClient) {
    Template.registerHelper('randomName', function () {
        return GameUtils.randomName();
    });
}

var RandomNames = [
    "Mr.Computer",
    "Mr.Bigglesworth",
    "MissTickles",
    "MrsMymind",
    "CaptainPants",
    "DirkGently",
    "ChairmanMeow",
    "Dr.FluffyPants",
    "CountCatula",
    "TheJabberwock",
    "DangerousDim",
    "Sgt.Circuit",
    "PresidentPrettyPants",
];


