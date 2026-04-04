CREATE OR REPLACE FUNCTION adjust_user_bonus_balance(
    p_user_id UUID,
    p_amount NUMERIC,
    p_reason TEXT
)
RETURNS void AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    -- Check if caller is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only administrators can adjust balances manually';
    END IF;

    -- Update user balance
    UPDATE users
    SET bonus_balance = bonus_balance + p_amount
    WHERE id = p_user_id
    RETURNING bonus_balance INTO v_new_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Prevent negative balance
    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient bonus balance';
    END IF;

    -- Log transaction
    INSERT INTO transactions (
        user_id,
        amount,
        type,
        status,
        description
    ) VALUES (
        p_user_id,
        p_amount,
        CASE WHEN p_amount >= 0 THEN 'DEPOSIT'::transaction_type ELSE 'WITHDRAWAL'::transaction_type END,
        'COMPLETED',
        'Admin Adjustment (Bonus): ' || p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
