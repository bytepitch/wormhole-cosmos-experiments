use borsh::{
    BorshDeserialize,
    BorshSerialize,
};
use bridge::{
    PostVAAData,
    PostedVAAData,
    DeserializePayload,
};

use token_bridge::messages::PayloadTransferWithPayload;

use solana_program::{
    account_info::{
        next_account_info,
        AccountInfo,
    },
    declare_id,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

use hex;

mod state;
use state::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[cfg(not(feature = "no-entrypoint"))]
use solana_program::entrypoint;

#[cfg(not(feature = "no-entrypoint"))]
entrypoint!(process_instruction);

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let (instruction_discriminant, instruction_data_inner) = instruction_data.split_at(1);
    match instruction_discriminant[0] {
        0 => {
            msg!("Instruction: Increment");
            process_increment_counter(accounts, instruction_data_inner)?;
        }
        1 => {
            msg!("BEFORE INST");
            process_init(accounts, instruction_data_inner)?
        }
        _ => {
            msg!("Error: unknown instruction")
        }
    }
    Ok(())
}

pub fn process_increment_counter(
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> Result<(), ProgramError> {
    let account_info_iter = &mut accounts.iter();

    let counter_account = next_account_info(account_info_iter)?;
    assert!(
        counter_account.is_writable,
        "Counter account must be writable"
    );

    let mut counter = Counter::try_from_slice(&counter_account.try_borrow_mut_data()?)?;
    counter.count += 1;
    counter.serialize(&mut *counter_account.data.borrow_mut())?;

    msg!("Counter state incremented to {:?}", counter.count);
    Ok(())
}

pub fn process_init(
    _accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> Result<(), ProgramError> {
    msg!("HELLO FROM CONTRACT");
    
    let vaa: PostVAAData = BorshDeserialize::try_from_slice(_instruction_data).unwrap();
    msg!("MY VAA PAYLOAD {:?}", vaa.payload);


    let payload = PayloadTransferWithPayload::deserialize(&mut vaa.payload.as_slice())
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    msg!("Parsed Payload:");
    msg!("Amount: {}", payload.amount);
    msg!("Token Address: {:?}", hex::encode(&payload.token_address));
    msg!("Token Chain: {}", payload.token_chain);
    msg!("To Address: {:?}", hex::encode(&payload.to));
    msg!("To Chain: {}", payload.to_chain);
    msg!("From Address: {:?}", hex::encode(&payload.from_address));
    msg!("Payload: {:?}", hex::encode(&payload.payload));

    Ok(())

