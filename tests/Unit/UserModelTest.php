<?php

namespace Tests\Unit;

use App\Models\User;
use Tests\TestCase;

class UserModelTest extends TestCase
{
    private string $defaultConnection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->defaultConnection = config('database.default');
    }

    protected function tearDown(): void
    {
        config(['database.default' => $this->defaultConnection]);

        parent::tearDown();
    }

    public function test_must_change_password_uses_postgres_boolean_literals_when_needed(): void
    {
        config(['database.default' => 'pgsql']);

        $user = new User();
        $user->must_change_password = true;

        $this->assertSame('true', $user->getAttributes()['must_change_password']);

        $user->must_change_password = false;

        $this->assertSame('false', $user->getAttributes()['must_change_password']);
    }

    public function test_must_change_password_uses_postgres_driver_even_for_custom_connection_name(): void
    {
        config([
            'database.default' => 'supabase',
            'database.connections.supabase.driver' => 'pgsql',
        ]);

        $user = new User();
        $user->must_change_password = false;

        $this->assertSame('false', $user->getAttributes()['must_change_password']);
    }

    public function test_must_change_password_reads_postgres_boolean_strings_as_booleans(): void
    {
        $user = new User();

        $user->setRawAttributes(['must_change_password' => 'false']);
        $this->assertFalse($user->must_change_password);
        $this->assertFalse($user->requiresPasswordChange());

        $user->setRawAttributes(['must_change_password' => 'f']);
        $this->assertFalse($user->must_change_password);
        $this->assertFalse($user->requiresPasswordChange());

        $user->setRawAttributes(['must_change_password' => 'true']);
        $this->assertTrue($user->must_change_password);
        $this->assertTrue($user->requiresPasswordChange());

        $user->setRawAttributes(['must_change_password' => 't']);
        $this->assertTrue($user->must_change_password);
        $this->assertTrue($user->requiresPasswordChange());
    }
}
