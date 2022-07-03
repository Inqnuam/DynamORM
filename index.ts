import { Players } from "./models/players";
import { UserReview } from "./models/userReview";
const newPlayer = {
  firstname: "  Serena",
  lastname: "williams",
  age: 8,
  sex: "F",
  isNew: true,
  oooooooooo: "invalid field",
  data: {
    anotherTrimmableFields: "      Hello World     ",
    nested: {
      bobo: {
        toto: {
          lolo: "    pooooooopopiiiii ii oio io     ",
        },
      },
      dontTakeme: "im sad :(",
    },
    rank: 3,
    // country: "SPA",
    // points: 23423,
    // weight: 1500,
    // height: 180,
    last: [1, 0, 1],
  },
  last: 8,
};

Players.on("ready", async () => {
  try {
    // const createdPlayer = await Players.create(newPlayer, { returnCreated: true, applyVirtualSetters: true });
    // const playerId = createdPlayer.Item.id;
    // const selectAsString = "firstname, lastname, data.rank, data.last";
    // const selectWithAlias = {
    //   id: "uuid",
    //   firstname: true,
    //   lastname: "nom de famille",
    //   "data:playerData": { anotherTrimmableFields: true, rank: true, last: "games", "nested:deep": { bobo: "je ne suis plus bobo" } },
    //   fullname: true,
    //   score_global: "RESULTaaass",
    // };
    // Players.getByPk(playerId, selectWithAlias).then((resonse) => {
    //   console.log("RECEIVED :)", resonse);
    // });
    const updatingId = "d5362382-faa7-42dc-89d4-814045836cec";
    const updatedPlayer = await Players.update(updatingId, 15);
    console.log(updatedPlayer.Attributes);
  } catch (error) {
    console.log("ERROR :(");
    console.error(error);
  }
});

// UserReview.on("ready", () => {
//   console.log("Created!");
// });
