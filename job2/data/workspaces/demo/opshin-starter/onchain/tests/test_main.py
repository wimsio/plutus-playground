from contracts.main import validator

def test_validator_returns_true():
    assert validator(None, None, None) is True
