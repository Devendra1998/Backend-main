import mongoose, {Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber:{
        type:Schema.Types.ObjectId, // One who subscribing
        ref:"User"
    },
    channel:{
        type:Schema.Types.ObjectId, // One whom subscribing
        ref:"User"
    }
},{timestamps:true});


const Subscription = mongoose.model("Subscription",subscriptionSchema);