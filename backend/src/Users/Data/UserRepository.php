<?php

declare(strict_types=1);

namespace App\Users\Data;

use App\Shared\Database\Database;
use PDO;

final class UserRepository
{
    private const USER_GROUPS = ['user', 'admin', 'wunschbesteller', 'wunscherfueller'];

    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::getConnection();
    }

    public function findAllForAdministration(): array
    {
        $stmt = $this->pdo->query(
            "SELECT id, email, `group`, required_password_reset, created_at, updated_at
             FROM users
             WHERE `group` IN ('admin', 'user')
             ORDER BY created_at DESC",
        );
        return $stmt->fetchAll();
    }

    public function findByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, email, `group`, required_password_reset, created_at, updated_at FROM users WHERE email = :email',
        );
        $stmt->execute(['email' => $this->normalizeEmail($email)]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findById(string $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, email, `group`, required_password_reset, created_at, updated_at FROM users WHERE id = :id',
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function isSuperuser(string $id): bool
    {
        $stmt = $this->pdo->prepare('SELECT superuser FROM users WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $value = $stmt->fetchColumn();

        return $value !== false && (bool) $value;
    }

    public function verifyPassword(string $email, string $password): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE email = :email');
        $stmt->execute(['email' => $this->normalizeEmail($email)]);
        $user = $stmt->fetch();

        if ($user === false || !password_verify($password, $user['password'])) {
            return null;
        }

        return $this->findById($user['id']);
    }

    public function createUser(
        string $email,
        string $password,
        string $group = 'user',
        bool $requiredPasswordReset = false,
    ): array {
        if (!in_array($group, self::USER_GROUPS, true)) {
            throw new \InvalidArgumentException('Invalid user group.');
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        if ($passwordHash === false) {
            throw new \RuntimeException('Could not hash password.');
        }

        $id = $this->createUuid();
        $stmt = $this->pdo->prepare(
            'INSERT INTO users (id, email, password, `group`, required_password_reset) '
            . 'VALUES (:id, :email, :password, :group, :required_password_reset)',
        );
        $stmt->execute([
            'id' => $id,
            'email' => $this->normalizeEmail($email),
            'password' => $passwordHash,
            'group' => $group,
            'required_password_reset' => $requiredPasswordReset ? 1 : 0,
        ]);

        $user = $this->findById($id);
        if ($user === null) {
            throw new \RuntimeException('Created user could not be loaded.');
        }

        return $user;
    }

    public function updatePassword(string $id, string $password): array
    {
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        if ($passwordHash === false) {
            throw new \RuntimeException('Could not hash password.');
        }

        $stmt = $this->pdo->prepare(
            'UPDATE users SET password = :password, required_password_reset = 0, '
            . 'updated_at = CURRENT_TIMESTAMP WHERE id = :id',
        );
        $stmt->execute(['password' => $passwordHash, 'id' => $id]);

        $user = $this->findById($id);
        if ($user === null) {
            throw new \RuntimeException('Updated user could not be loaded.');
        }

        return $user;
    }

    public function updateUser(
        string $id,
        string $email,
        string $group,
        bool $requiredPasswordReset,
    ): ?array {
        if (!in_array($group, self::USER_GROUPS, true)) {
            throw new \InvalidArgumentException('Invalid user group.');
        }

        $stmt = $this->pdo->prepare(
            'UPDATE users SET email = :email, `group` = :group, '
            . 'required_password_reset = :required_password_reset, '
            . 'updated_at = CURRENT_TIMESTAMP WHERE id = :id',
        );
        $stmt->execute([
            'id' => $id,
            'email' => $this->normalizeEmail($email),
            'group' => $group,
            'required_password_reset' => $requiredPasswordReset ? 1 : 0,
        ]);

        return $this->findById($id);
    }

    public function deleteUser(string $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM users WHERE id = :id');
        $stmt->execute(['id' => $id]);

        return $stmt->rowCount() > 0;
    }

    private function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    private function createUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
