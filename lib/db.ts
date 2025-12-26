import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'family_tree',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Create families table first (needed for foreign keys)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS families (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        family_code VARCHAR(50) UNIQUE,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_created_by (created_by),
        INDEX idx_family_code (family_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Add family_code column if missing
    try {
      const [columns]: any = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'families' AND COLUMN_NAME = 'family_code'`
      );
      if (columns.length === 0) {
        await connection.query(`ALTER TABLE families ADD COLUMN family_code VARCHAR(50) UNIQUE;`);
        await connection.query(`CREATE INDEX idx_family_code ON families(family_code);`);
      }
    } catch (err: any) {
      if (err?.errno !== 1060 && err?.errno !== 1061 && err?.errno !== 1022) {
        console.error('Error adding family_code to families:', err);
      }
    }

    // Create audit log table for tracking changes to family members
    await connection.query(`
      CREATE TABLE IF NOT EXISTS member_audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        member_id INT NOT NULL,
        action ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
        changed_by INT,
        changed_fields TEXT,
        old_values TEXT,
        new_values TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
        FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_member_id (member_id),
        INDEX idx_action (action),
        INDEX idx_changed_by (changed_by),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create family_members table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS family_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        member_code VARCHAR(50) UNIQUE,
        name VARCHAR(255) NOT NULL,
        gender ENUM('male', 'female') NOT NULL,
        birth_date DATE,
        death_date DATE,
        father_id INT,
        mother_id INT,
        spouse_id INT,
        child_order INT,
        no_hp VARCHAR(50),
        alamat TEXT,
        email VARCHAR(255),
        photo_url VARCHAR(500),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        FOREIGN KEY (father_id) REFERENCES family_members(id) ON DELETE SET NULL,
        FOREIGN KEY (mother_id) REFERENCES family_members(id) ON DELETE SET NULL,
        FOREIGN KEY (spouse_id) REFERENCES family_members(id) ON DELETE SET NULL,
        INDEX idx_family_id (family_id),
        INDEX idx_member_code (member_code),
        INDEX idx_father (father_id),
        INDEX idx_mother (mother_id),
        INDEX idx_spouse (spouse_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Add member_code column if missing
    try {
      const [columns]: any = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'family_members' AND COLUMN_NAME = 'member_code'`
      );
      if (columns.length === 0) {
        await connection.query(`ALTER TABLE family_members ADD COLUMN member_code VARCHAR(50);`);
        await connection.query(`CREATE UNIQUE INDEX idx_member_code ON family_members(member_code);`);
        // Generate member_code for existing members
        const [existingMembers]: any = await connection.query(
          `SELECT id FROM family_members WHERE member_code IS NULL`
        );
        for (const member of existingMembers) {
          const memberCode = `MEM${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          await connection.query(
            `UPDATE family_members SET member_code = ? WHERE id = ?`,
            [memberCode, member.id]
          );
        }
      }
    } catch (err: any) {
      if (err?.errno !== 1060 && err?.errno !== 1061 && err?.errno !== 1022) {
        console.error('Error adding member_code to family_members:', err);
      }
    }

    // Helper function to add columns safely (ignore duplicate column error)
    const addColumn = async (sql: string) => {
      try {
        await connection.query(sql);
      } catch (err: any) {
        // ER_DUP_FIELDNAME = 1060 → column already exists; ignore
        if (err?.errno !== 1060) throw err;
      }
    };

    // Add family_id column if missing (for existing tables)
    try {
      // First, check if column exists
      const [columns]: any = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'family_members' AND COLUMN_NAME = 'family_id'`
      );
      
      if (columns.length === 0) {
        // Create default family first
        const [defaultFamily]: any = await connection.query(
          `INSERT INTO families (name, description) VALUES ('Default Family', 'Default family for existing members')`
        );
        const defaultFamilyId = defaultFamily.insertId;
        
        // Add column as nullable first
        await connection.query(`ALTER TABLE family_members ADD COLUMN family_id INT;`);
        // Set default family_id for existing records
        await connection.query(`UPDATE family_members SET family_id = ? WHERE family_id IS NULL`, [defaultFamilyId]);
        // Make it NOT NULL
        await connection.query(`ALTER TABLE family_members MODIFY COLUMN family_id INT NOT NULL;`);
        // Add foreign key
        try {
          await connection.query(`ALTER TABLE family_members ADD FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;`);
        } catch (err: any) {
          // Foreign key might already exist
          if (err?.errno !== 1215 && err?.errno !== 1022) throw err;
        }
      } else {
        // Column exists, ensure existing records have family_id
        const [existingRecords]: any = await connection.query(
          `SELECT COUNT(*) as count FROM family_members WHERE family_id IS NULL OR family_id = 0`
        );
        if (existingRecords[0].count > 0) {
          // Create or get default family
          let defaultFamilyId;
          const [defaultFam]: any = await connection.query(`SELECT id FROM families WHERE name = 'Default Family' LIMIT 1`);
          if (defaultFam.length > 0) {
            defaultFamilyId = defaultFam[0].id;
          } else {
            const [newDefault]: any = await connection.query(
              `INSERT INTO families (name, description) VALUES ('Default Family', 'Default family for existing members')`
            );
            defaultFamilyId = newDefault.insertId;
          }
          await connection.query(`UPDATE family_members SET family_id = ? WHERE family_id IS NULL OR family_id = 0`, [defaultFamilyId]);
        }
      }
    } catch (err: any) {
      // Ignore if error is not critical
      if (err?.errno !== 1060 && err?.errno !== 1215 && err?.errno !== 1022) {
        console.error('Error adding family_id to family_members:', err);
        throw err;
      }
    }

    // Ensure child_order column exists for legacy tables
    await addColumn(`ALTER TABLE family_members ADD COLUMN child_order INT;`);
    
    // Add new contact columns if missing
    await addColumn(`ALTER TABLE family_members ADD COLUMN no_hp VARCHAR(50);`);
    await addColumn(`ALTER TABLE family_members ADD COLUMN alamat TEXT;`);
    await addColumn(`ALTER TABLE family_members ADD COLUMN email VARCHAR(255);`);

    // Create family_events table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS family_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        event_time TIME,
        location VARCHAR(500),
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES family_members(id) ON DELETE SET NULL,
        INDEX idx_family_id (family_id),
        INDEX idx_event_date (event_date),
        INDEX idx_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Add family_id to family_events if missing
    try {
      const [columns]: any = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'family_events' AND COLUMN_NAME = 'family_id'`
      );
      
      if (columns.length === 0) {
        const [defaultFamily]: any = await connection.query(`SELECT id FROM families LIMIT 1`);
        if (defaultFamily.length > 0) {
          const defaultFamilyId = defaultFamily[0].id;
          await connection.query(`ALTER TABLE family_events ADD COLUMN family_id INT;`);
          await connection.query(`UPDATE family_events SET family_id = ? WHERE family_id IS NULL`, [defaultFamilyId]);
          await connection.query(`ALTER TABLE family_events MODIFY COLUMN family_id INT NOT NULL;`);
          try {
            await connection.query(`ALTER TABLE family_events ADD FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;`);
          } catch (err: any) {
            if (err?.errno !== 1215 && err?.errno !== 1022) throw err;
          }
        }
      }
    } catch (err: any) {
      if (err?.errno !== 1060 && err?.errno !== 1215 && err?.errno !== 1022) {
        console.error('Error adding family_id to family_events:', err);
      }
    }

    // Create users table for admin
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('superadmin', 'admin', 'member') DEFAULT 'member',
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        family_id INT,
        member_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL,
        FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE SET NULL,
        INDEX idx_username (username),
        INDEX idx_role (role),
        INDEX idx_status (status),
        INDEX idx_family_id (family_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Modify or add role column to include superadmin
    try {
      await connection.query(`ALTER TABLE users MODIFY COLUMN role ENUM('superadmin', 'admin', 'member') DEFAULT 'member';`);
    } catch (err: any) {
      if (err?.errno === 1054) {
        // Column doesn't exist, add it
        await addColumn(`ALTER TABLE users ADD COLUMN role ENUM('superadmin', 'admin', 'member') DEFAULT 'member';`);
      } else if (err?.errno !== 1060) {
        throw err;
      }
    }
    
    // Modify or add status column - default to approved (no more approval needed)
    try {
      await connection.query(`ALTER TABLE users MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved';`);
      // Update existing pending users to approved
      await connection.query(`UPDATE users SET status = 'approved' WHERE status = 'pending';`);
    } catch (err: any) {
      if (err?.errno === 1054) {
        await addColumn(`ALTER TABLE users ADD COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved';`);
      } else if (err?.errno !== 1060) {
        throw err;
      }
    }
    
    // Add family_id column if missing
    try {
      const [columns]: any = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'family_id'`
      );
      
      if (columns.length === 0) {
        await connection.query(`ALTER TABLE users ADD COLUMN family_id INT;`);
        // Set default family_id for existing users
        const [defaultFamily]: any = await connection.query(`SELECT id FROM families LIMIT 1`);
        if (defaultFamily.length > 0) {
          await connection.query(`UPDATE users SET family_id = ? WHERE family_id IS NULL`, [defaultFamily[0].id]);
        }
        // Add foreign key if missing
        try {
          await connection.query(`ALTER TABLE users ADD FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL;`);
        } catch (err: any) {
          if (err?.errno !== 1215 && err?.errno !== 1022) throw err;
        }
      }
    } catch (err: any) {
      if (err?.errno !== 1060 && err?.errno !== 1215 && err?.errno !== 1022) {
        console.error('Error adding family_id to users:', err);
      }
    }

    // Add member_id column if missing
    await addColumn(`ALTER TABLE users ADD COLUMN member_id INT;`);
    
    // Add foreign key if missing (need to handle separately as it's not a column)
    try {
      await connection.query(`ALTER TABLE users ADD FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE SET NULL;`);
    } catch (err: any) {
      // Ignore duplicate key error
      if (err?.errno !== 1215 && err?.errno !== 1022) throw err;
    }

    // Create documentation table for photos and videos
    await connection.query(`
      CREATE TABLE IF NOT EXISTS documentation (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_type ENUM('photo', 'video') NOT NULL,
        file_url VARCHAR(1000) NOT NULL,
        thumbnail_url VARCHAR(1000),
        event_id INT,
        uploaded_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES family_events(id) ON DELETE SET NULL,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_family_id (family_id),
        INDEX idx_file_type (file_type),
        INDEX idx_event_id (event_id),
        INDEX idx_uploaded_by (uploaded_by),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Add family_id to documentation if missing
    try {
      const [columns]: any = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documentation' AND COLUMN_NAME = 'family_id'`
      );
      
      if (columns.length === 0) {
        const [defaultFamily]: any = await connection.query(`SELECT id FROM families LIMIT 1`);
        if (defaultFamily.length > 0) {
          const defaultFamilyId = defaultFamily[0].id;
          await connection.query(`ALTER TABLE documentation ADD COLUMN family_id INT;`);
          await connection.query(`UPDATE documentation SET family_id = ? WHERE family_id IS NULL`, [defaultFamilyId]);
          await connection.query(`ALTER TABLE documentation MODIFY COLUMN family_id INT NOT NULL;`);
          try {
            await connection.query(`ALTER TABLE documentation ADD FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;`);
          } catch (err: any) {
            if (err?.errno !== 1215 && err?.errno !== 1022) throw err;
          }
        }
      }
    } catch (err: any) {
      if (err?.errno !== 1060 && err?.errno !== 1215 && err?.errno !== 1022) {
        console.error('Error adding family_id to documentation:', err);
      }
    }
    
    connection.release();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export default pool;
