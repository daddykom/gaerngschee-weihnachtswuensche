<?php

declare(strict_types=1);

namespace Tests\Users;

use App\Users\Data\UserRepository;
use Tests\Support\TestDatabase;
use PDO;
use PHPUnit\Framework\TestCase;

final class UserRepositoryTest extends TestCase
{
    private PDO $pdo;
    private UserRepository $repository;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->repository = new UserRepository($this->pdo);
    }

    public function testCreateUserStoresHashAndReturnsSafeUser(): void
    {
        $user = $this->repository->createUser('client@example.com', 'secret', 'wunschbesteller');

        self::assertSame('client@example.com', $user['email']);
        self::assertSame('wunschbesteller', $user['group']);
        self::assertFalse((bool) $user['required_password_reset']);
        self::assertArrayNotHasKey('password', $user);

        $stored = $this->pdo->query('SELECT password FROM users')->fetchColumn();
        self::assertIsString($stored);
        self::assertTrue(password_verify('secret', $stored));
    }

    public function testVerifyPasswordReturnsSafeUserOnlyForCorrectPassword(): void
    {
        $this->repository->createUser('user@example.com', 'secret');

        self::assertNotNull($this->repository->verifyPassword('user@example.com', 'secret'));
        self::assertNull($this->repository->verifyPassword('user@example.com', 'wrong'));
    }

    public function testFindByIdAndEmailDoNotExposePassword(): void
    {
        $created = $this->repository->createUser('admin@example.com', 'secret', 'admin');

        self::assertSame($created, $this->repository->findById($created['id']));
        self::assertSame($created, $this->repository->findByEmail('admin@example.com'));
    }

    public function testInvalidGroupIsRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->repository->createUser('person@example.com', 'secret', 'invalid');
    }

    public function testDuplicateEmailIsRejectedByDatabase(): void
    {
        $this->repository->createUser('person@example.com', 'secret');

        $this->expectException(\PDOException::class);
        $this->repository->createUser('person@example.com', 'another-secret');
    }

    public function testNewUserCanRequirePasswordResetAndEmailsAreNormalized(): void
    {
        $user = $this->repository->createUser(' Person@Example.com ', 'secret', 'user', true);

        self::assertSame('person@example.com', $user['email']);
        self::assertTrue((bool) $user['required_password_reset']);
    }
}
