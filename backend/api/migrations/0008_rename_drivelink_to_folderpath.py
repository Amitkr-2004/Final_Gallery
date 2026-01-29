# Generated migration for Time Scheduler local folder path feature

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_add_scheduled_job'),
    ]

    operations = [
        migrations.RenameField(
            model_name='scheduledjob',
            old_name='drive_link',
            new_name='folder_path',
        ),
        migrations.AlterField(
            model_name='scheduledjob',
            name='folder_path',
            field=models.CharField(
                max_length=500,
                help_text="Local folder path containing images (absolute path)"
            ),
        ),
    ]
