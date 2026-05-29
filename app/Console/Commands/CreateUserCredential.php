<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CreateUserCredential extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:create 
                            {username : The username}
                            {password : The password}
                            {--role=Client : The user role (Admin, Marketing, Accounting, or Client)}
                            {--email= : Optional email address}
                            {--phone= : Optional phone number}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a new user credential with persistent database storage';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $username = $this->argument('username');
        $password = $this->argument('password');
        $role = $this->option('role');
        $email = $this->option('email');
        $phone = $this->option('phone');

        // Validate role
        $validRoles = ['Admin', 'Marketing', 'Accounting', 'Client'];
        if (!in_array($role, $validRoles)) {
            $this->error("Invalid role. Must be one of: " . implode(', ', $validRoles));
            return 1;
        }

        // Check if username already exists
        if (User::where('username', $username)->exists()) {
            $this->error("Username '{$username}' already exists!");
            return 1;
        }

        // Create user
        try {
            $user = User::create([
                'username' => $username,
                'password' => $password, // Auto-hashed by User model
                'role' => $role,
                'email' => $email,
                'phone' => $phone,
            ]);

            $this->info('✓ User created successfully!');
            $this->line('');
            $this->table(
                ['Field', 'Value'],
                [
                    ['Username', $user->username],
                    ['Password', $password],
                    ['Role', $user->role],
                    ['Email', $user->email ?? '(none)'],
                    ['Phone', $user->phone ?? '(none)'],
                ]
            );
            $this->line('');
            $this->info('✓ This credential is now stored in the database and will work on any device!');

            return 0;
        } catch (\Exception $e) {
            $this->error("Error creating user: " . $e->getMessage());
            return 1;
        }
    }
}
