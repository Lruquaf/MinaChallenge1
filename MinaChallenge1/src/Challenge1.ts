import {
    Field,
    SmartContract,
    state,
    State,
    method,
    PublicKey,
    Mina,
    PrivateKey,
    Struct,
    Reducer,
    Provable,
    Bool,
} from 'o1js';
import { Gadgets } from 'o1js/dist/node/lib/gadgets/gadgets';

const Local = Mina.LocalBlockchain({ proofsEnabled: false });
Mina.setActiveInstance(Local);
const { privateKey: deployerKey, publicKey: deployerAccount } =
    Local.testAccounts[0];

const BITMASK_6_BITS = Field(0b111111);

export class EligibleAddress extends Struct({
    address: PublicKey,
    message: Field,
}) {
    constructor(address: PublicKey, message: Field) {
        super({ address, message });
        this.address = address;
        this.message = message;
    }
}

export class Challenge1 extends SmartContract {
    reducer = Reducer({ actionType: EligibleAddress });

    @state(PublicKey) adminPubKey = State<PublicKey>();
    @state(Field) messageCounter = State<Field>();
    @state(Field) addressCounter = State<Field>();
    @state(Field) actionState = State<Field>();
    init() {
        super.init();
        this.messageCounter.set(Field(0));
        this.addressCounter.set(Field(0));
        this.actionState.set(Reducer.initialActionState);
        this.adminPubKey.set(deployerAccount);
    }

    @method storeAddress(eligibleAddress: PublicKey, adminPrivKey: PrivateKey) {
        adminPrivKey
            .toPublicKey()
            .assertEquals(this.adminPubKey.getAndRequireEquals());
        this.isAddressUnique(eligibleAddress);
        this.reducer.dispatch(new EligibleAddress(eligibleAddress, Field(0)));
        const currentAddressCounter = this.addressCounter.getAndRequireEquals();
        const newAddressCounter = currentAddressCounter.add(Field(1));
        this.addressCounter.set(newAddressCounter);
    }
    @method storeMessage(message: Field, userPrivKey: PrivateKey) {
        let userPubKey = userPrivKey.toPublicKey();
        this.isAddressEligible(userPubKey);
        this.isMessageValid(message);
        this.reducer.dispatch(new EligibleAddress(userPubKey, message));
        const currentMessageCounter = this.messageCounter.getAndRequireEquals();
        const newMessageCounter = currentMessageCounter.add(Field(1));
        this.messageCounter.set(newMessageCounter);
    }
    @method isAddressUnique(address: PublicKey) {
        const currentActionState = this.actionState.getAndRequireEquals();
        let eligibleAddresses = this.reducer.getActions({
            fromActionState: currentActionState,
        });
        let initial = {
            state: Field(0),
            actionState: Reducer.initialActionState,
        };
        let { state, actionState } = this.reducer.reduce(
            eligibleAddresses,
            Field,
            (state: Field, action: EligibleAddress) =>
                Provable.if(
                    action.address.equals(address),
                    state.add(1),
                    state
                ),
            initial,
            { skipActionStatePrecondition: true }
        );
        state.assertEquals(0);
    }
    @method isAddressEligible(address: PublicKey) {
        const currentActionState = this.actionState.getAndRequireEquals();
        let eligibleAddresses = this.reducer.getActions({
            fromActionState: currentActionState,
        });
        let initial = {
            state: Field(0),
            actionState: Reducer.initialActionState,
        };
        let { state, actionState } = this.reducer.reduce(
            eligibleAddresses,
            Field,
            (state: Field, action: EligibleAddress) =>
                Provable.if(
                    action.address.equals(address),
                    state.add(1),
                    state
                ),
            initial,
            { skipActionStatePrecondition: true }
        );
        state.assertEquals(1);
    }

    @method isMessageValid(message: Field) {
        let flags = Gadgets.and(message, BITMASK_6_BITS, 256).toBits(6);
        let flag_1 = flags[5];
        let flag_2 = flags[4];
        let flag_3 = flags[3];
        let flag_4 = flags[2];
        let flag_5 = flags[1];
        let flag_6 = flags[0];

        Provable.if(
            flag_1,
            flag_2
                .or(flag_3)
                .or(flag_4)
                .or(flag_5)
                .or(flag_6)
                .equals(Bool(true)),
            Bool(false)
        ).assertEquals(Bool(false));

        Provable.if(
            flag_2,
            flag_3.equals(Bool(false)),
            Bool(false)
        ).assertEquals(Bool(false));

        Provable.if(
            flag_4,
            flag_5.or(flag_6).equals(Bool(true)),
            Bool(false)
        ).assertEquals(Bool(false));
    }
}
