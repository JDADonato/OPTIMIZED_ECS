<?php

namespace App\Rules;

use App\Support\PasswordPolicy;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class BalancedPassword implements ValidationRule
{
    public function __construct(
        private readonly ?string $username = null,
        private readonly ?string $email = null,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        foreach (PasswordPolicy::failures((string) $value, [
            'username' => $this->username,
            'email' => $this->email,
        ]) as $message) {
            $fail($message);
        }
    }
}
