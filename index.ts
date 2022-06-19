import { Players } from "./models/players";

const newPlayer = {
    firstname: "Serena",
    lastname: "Williams",
    age: 242,
    sex: "F",
    isNew: true,
    oooooooooo: "invalid field",
    data: {
        rank: 2,
        points: 23423,
        weight: 1500,
        height: 180,
        last: [1, 0, 1],
    },
    last: 8,
};

Players.on("ready", async () => {
    const createdPlayer = await Players.create(newPlayer, { returnCreated: true });

    const playerId = createdPlayer.Item.id;
    const selectOptions = undefined; // { firstname: true, lastname: "nom de famille", data: false, fullname: true };

    Players.getByPk(playerId, selectOptions).then((resonse) => {
        console.log("RECEIVED :)", resonse);
    });
});
