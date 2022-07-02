import { Players } from "./models/players";
import { UserReview } from "./models/userReview";
const newPlayer = {
  firstname: "Serena",
  lastname: "Williams",
  age: 8,
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
  last: 5,
};

Players.on("ready", async () => {
  try {
    const createdPlayer = await Players.create(newPlayer, { returnCreated: true });

    const playerId = createdPlayer.Item.id;
    const selectOptions = undefined; //{ firstname: true, lastname: "nom de famille", data: false, fullname: true };

    Players.getByPk(playerId, selectOptions).then((resonse) => {
      console.log("RECEIVED :)", resonse);
    });
  } catch (error) {
    console.log("ERROR :(", error);
  }
});

// UserReview.on("ready", () => {
//   console.log("Created!");
// });
