<?php

namespace App\Policies;

use App\Models\BusinessRule;
use App\Models\User;

class BusinessRulePolicy
{
    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, BusinessRule $businessRule): bool
    {
        return in_array($user->role, ['Admin', 'Accounting']);
    }
}
