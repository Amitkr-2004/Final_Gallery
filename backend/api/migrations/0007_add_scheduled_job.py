# Manual migration to add ScheduledJob model
# Created on 2026-01-26

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_add_confidence_to_personphoto'),
    ]

    operations = [
        migrations.CreateModel(
            name='ScheduledJob',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('scheduled_time', models.DateTimeField(db_index=True, help_text='When this job should execute (timezone-aware)')),
                ('drive_link', models.URLField(help_text='Google Drive folder link containing images', max_length=500)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('running', 'Running'), ('completed', 'Completed'), ('failed', 'Failed')], db_index=True, default='pending', help_text='Current job status', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('started_at', models.DateTimeField(blank=True, help_text='When job execution started', null=True)),
                ('completed_at', models.DateTimeField(blank=True, help_text='When job finished (success or failure)', null=True)),
                ('event_id', models.CharField(blank=True, help_text="Created event ID (e.g., 'student-images-1234567890')", max_length=100, null=True)),
                ('images_processed', models.IntegerField(default=0, help_text='Number of images successfully processed')),
                ('faces_detected', models.IntegerField(default=0, help_text='Total faces detected across all images')),
                ('error_log', models.TextField(blank=True, help_text='Full error traceback if job failed')),
                ('is_active', models.BooleanField(db_index=True, default=True, help_text='False = soft deleted (preserves history)')),
            ],
            options={
                'verbose_name': 'Scheduled Job',
                'verbose_name_plural': 'Scheduled Jobs',
                'ordering': ['-scheduled_time'],
                'indexes': [
                    models.Index(fields=['scheduled_time', 'status'], name='api_schedul_schedul_idx'),
                    models.Index(fields=['is_active', 'status'], name='api_schedul_is_acti_idx'),
                ],
            },
        ),
    ]
